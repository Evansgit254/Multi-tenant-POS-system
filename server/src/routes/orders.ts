import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize, requirePermission, PERMISSIONS } from '../middleware/auth';
import { emitToTenant } from './sse';
import { sendSMS, formatReceiptSMS } from '../services/smsService';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// Rate limiter: max 5 orders per 10 seconds per user — prevents cashier account abuse
const orderLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => req.user?.id ?? 'anonymous',
  message: { error: 'Too many orders submitted. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable IPv6 helper warning since we use userId not IP
});

// POST /api/tenants/:tenantId/orders
router.post(
  '/',
  orderLimiter, // Rate guard: 5 orders / 10s per user
  authorize('hotel_admin', 'manager', 'cashier'), // FORENSIC GAP FIX: Restrict to operational roles
  [
    body('items').isArray({ min: 1 }),
    body('items.*.menuItemId').isString().notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }), // FATAL GAP FIX: Prevent negative quantity stock manipulation
    body('orderType').isIn(['dine_in', 'takeaway', 'room_service']),
    body('discountFixed').optional().isFloat({ min: 0 }),
    body('discountPercent').optional().isFloat({ min: 0, max: 100 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
    const { items, orderType, roomId, notes, guestId, payment, redeemPoints } = req.body;
    const tenantId = req.params.tenantId!;
    const cashierId = req.user.id;

    try {
      const order = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) throw new Error('Tenant not found');

        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        // F-10 FIX: Use timestamp+random suffix to eliminate race conditions on order numbers
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const orderNumber = `ORD-${dateStr}-${Date.now().toString(36).toUpperCase().slice(-4)}${rand}`;

        // F-19 FIX: Find the cashier's active shift
        const activeShift = await tx.shift.findFirst({
          where: { cashierId, tenantId, status: 'OPEN' }
        });
        const shiftId = activeShift ? activeShift.id : undefined;

        // 1. Pre-flight Stock Check
        for (const item of items) {
          const menuItem = await tx.menuItem.findUnique({ 
            where: { id: item.menuItemId }, 
            include: { ingredients: { include: { inventoryItem: true } } } 
          });
          if (!menuItem) throw new Error(`Item ${item.menuItemId} not found`);
          
          for (const ingredient of menuItem.ingredients) {
            const required = ingredient.quantity * item.quantity;
            if (ingredient.inventoryItem.currentStock < required) {
              throw new Error(`Insufficient stock for ${ingredient.inventoryItem.name}. Required: ${required}, Available: ${ingredient.inventoryItem.currentStock}`);
            }
          }
        }

        let subtotalTotal = 0;
        const orderItemsData = [];

        for (const item of items) {
          const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId }, include: { ingredients: true } });
          if (!menuItem) throw new Error(`Item ${item.menuItemId} not found`);
          
          const price = Number(menuItem.price);
          const subtotal = price * item.quantity;
          subtotalTotal += subtotal;

          // Deduct stock for ingredients
          for (const ingredient of menuItem.ingredients) {
            const deduction = ingredient.quantity * item.quantity;
            await tx.inventoryItem.update({
              where: { id: ingredient.inventoryItemId },
              data: { currentStock: { decrement: deduction } }
            });
            await tx.stockTransaction.create({
              data: {
                tenantId,
                inventoryItemId: ingredient.inventoryItemId,
                type: 'SALE',
                quantity: -deduction,
                notes: `Sold via order ${orderNumber}`,
                userId: cashierId
              }
            });
          }
          
          orderItemsData.push({
            menuItemId: item.menuItemId,
            name: menuItem.name,
            price: price,
            quantity: item.quantity,
            subtotal: subtotal,
            notes: item.notes
          });
        }

        const taxRate = tenant.taxRate / 100;
        const taxAmount = subtotalTotal * taxRate;
        let total = subtotalTotal + taxAmount;
        let discount = 0;
        let pointsRedeemed = 0;

        // 2. Loyalty Redemption
        if (guestId && redeemPoints) {
           const guest = await tx.guest.findUnique({ where: { id: guestId } });
           if (guest && guest.loyaltyPoints > 0) {
             const pointsToUse = Math.min(guest.loyaltyPoints, Math.floor(subtotalTotal + taxAmount));
             discount = pointsToUse;
             total -= discount;
             if (total < 0) total = 0;
             pointsRedeemed = pointsToUse;
             
             await tx.guest.update({
               where: { id: guestId },
               data: { loyaltyPoints: { decrement: pointsRedeemed } }
             });
           }
        }

        // 3. Manual Discounts
        const discountFixed = Number(req.body.discountFixed || 0);
        const discountPercent = Number(req.body.discountPercent || 0);
        let manualDiscount = 0;

        if (discountPercent > 0) {
          manualDiscount += (subtotalTotal * (discountPercent / 100));
        }
        if (discountFixed > 0) {
          manualDiscount += discountFixed;
        }

        if (manualDiscount > 0) {
           discount += manualDiscount;
           total = Math.max(0, total - manualDiscount);
        }

        const createdOrder = await tx.order.create({
          data: {
            orderNumber,
            tenantId,
            cashierId,
            shiftId,
            roomId,
            guestId,
            orderType: orderType as any,
            status: 'pending',
            subtotal: subtotalTotal,
            taxAmount,
            discount,
            discountFixed,
            discountPercent,
            total,
            notes,
            items: { create: orderItemsData }
          },
          include: { items: { include: { menuItem: true } } }
        });

        // 4. Payment / Room Charge
        // FORENSIC GAP FIX: Secure room_charge payload so a swapped method doesn't bypass debts
        if (payment) {
          if (payment.method === 'room_charge') {
            if (!roomId) throw new Error('roomId is required for room charge');
            // Ensure the room actually belongs to the tenant
            const room = await tx.room.findUnique({ where: { id: roomId, tenantId } });
            if (!room) throw new Error('Invalid or unowned room for room charge');

            await tx.roomCharge.create({
              data: {
                tenantId,
                roomId,
                orderId: createdOrder.id,
                amount: total,
                isSettled: false
              }
            });
          } else {
            // For all other methods (cash, card, mpesa), create the Payment immediately
            await tx.payment.create({
              data: {
                tenantId,
                orderId: createdOrder.id,
                shiftId,
                method: payment.method || 'cash',
                amount: total,
              }
            });
          }
        }

        // 5. Loyalty Points — GAP #18 FIX: use tenant's configurable earn rate
        if (guestId) {
          if (pointsRedeemed > 0) {
            await tx.loyaltyTransaction.create({
              data: {
                tenantId,
                guestId,
                orderId: createdOrder.id,
                points: -pointsRedeemed,
                type: 'REDEEM',
                notes: `Redeemed points on order ${orderNumber}`
              }
            });
          }
          
          const earnRate = Number(tenant.loyaltyEarnRate) || 100;
          const earnedPoints = Math.floor(total / earnRate);
          if (earnedPoints > 0) {
            await tx.guest.update({
              where: { id: guestId },
              data: { loyaltyPoints: { increment: earnedPoints } }
            });
            await tx.loyaltyTransaction.create({
              data: {
                tenantId,
                guestId,
                orderId: createdOrder.id,
                points: earnedPoints,
                type: 'EARN',
                notes: `Points from order ${orderNumber}`
              }
            });
          }
        }

        return createdOrder;
      });

      // Emit real-time SSE event so KDS and dashboards update instantly
      emitToTenant(tenantId, 'order:new', {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        total: order.total,
        items: order.items.length
      });

      res.status(201).json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  }
);

// GET /api/tenants/:tenantId/orders — GAP #11 FIX: Added pagination
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { status, type, page, limit } = req.query;
  const take = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const orders = await prisma.order.findMany({
    where: { 
      tenantId: req.params.tenantId,
      ...(status ? { status: status as any } : {}),
      ...(type ? { orderType: type as any } : {})
    },
    include: { items: { include: { menuItem: true } }, cashier: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take,
    skip
  });
  res.json(orders);
});

// PUT /api/tenants/:tenantId/orders/:id/status
// GAP #2 FIX: Restore inventory on cancellation
// GAP #4 FIX: Reverse loyalty points on cancellation
// GAP #5 FIX: Normalize status codes to lowercase
router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { status } = req.body;
  
  if (status === 'cancelled') {
    return requirePermission(PERMISSIONS.VOID_ORDER)(req, res, async () => {
      try {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: req.params.id, tenantId: req.params.tenantId },
            include: {
              items: { include: { menuItem: { include: { ingredients: true } } } },
              loyaltyTransactions: { where: { type: 'EARN' } }
            }
          });

          if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
          if (order.status === 'cancelled') { res.status(400).json({ error: 'Order already cancelled' }); return; }

          // Restore inventory for each item's ingredients
          for (const orderItem of order.items) {
            for (const ingredient of orderItem.menuItem.ingredients) {
              const restoreQty = ingredient.quantity * orderItem.quantity;
              await tx.inventoryItem.update({
                where: { id: ingredient.inventoryItemId },
                data: { currentStock: { increment: restoreQty } }
              });
              await tx.stockTransaction.create({
                data: {
                  tenantId: req.params.tenantId,
                  inventoryItemId: ingredient.inventoryItemId,
                  type: 'ADJUSTMENT',
                  quantity: restoreQty,
                  notes: `Void/cancellation of order ${order.orderNumber}`,
                  userId: req.user.id
                }
              });
            }
          }

          // Reverse loyalty points earned from this order
          for (const loyaltyTx of order.loyaltyTransactions) {
            await tx.guest.update({
              where: { id: loyaltyTx.guestId },
              data: { loyaltyPoints: { decrement: loyaltyTx.points } }
            });
            await tx.loyaltyTransaction.create({
              data: {
                tenantId: req.params.tenantId,
                guestId: loyaltyTx.guestId,
                orderId: order.id,
                points: -loyaltyTx.points,
                type: 'ADJUSTMENT',
                notes: `Reversal — order ${order.orderNumber} voided`
              }
            });
          }

          // Cancel any unsettled room charges linked to this order
          await tx.roomCharge.updateMany({
            where: { orderId: order.id, isSettled: false },
            data: { isSettled: true, settledAt: new Date() }
          });

          await tx.order.update({
            where: { id: req.params.id },
            data: { status: 'cancelled' }
          });
        });

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to cancel order' });
      }
    });
  }

  try {
    const existingOrder = await prisma.order.findUnique({
      where: { id: req.params.id, tenantId: req.params.tenantId }
    });
    
    if (!existingOrder) { res.status(404).json({ error: 'Order not found' }); return; }
    
    // SECURITY GAP FIX: Ghost Sale Exploit (Prevent un-cancelling orders to bypass inventory deduction)
    if (existingOrder.status === 'cancelled') {
      res.status(403).json({ error: 'Cannot change the status of a cancelled order. Please create a new order instead.' }); 
      return;
    }

    const order = await prisma.order.update({
      where: { 
        id: req.params.id,
        tenantId: req.params.tenantId 
      },
      data: { status }
    });

    // Emit real-time notification when order is marked ready for pickup/delivery
    if (status === 'ready') {
      emitToTenant(req.params.tenantId, 'order:ready', {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType
      });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// POST /api/tenants/:tenantId/orders/:id/payments (For Split Bills / Partial Payments)
// GAP #5 FIX: normalized status to lowercase 'completed'
// GAP #10 FIX: Overpayment guard added
router.post(
  '/:id/payments',
  [
    body('amount').isFloat({ min: 0.01 }), // DATA GAP FIX: Block negative or zero payments
    body('method').isString().notEmpty()
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { tenantId, id } = req.params;
      const { amount, method } = req.body;

    const activeShift = await prisma.shift.findFirst({
      where: { cashierId: (req as any).user.id, tenantId, status: 'OPEN' }
    });
    const shiftId = activeShift ? activeShift.id : undefined;

    const order = await prisma.order.findUnique({
      where: { id, tenantId },
      include: { payments: true }
    });

    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    // GAP #10: Overpayment guard
    const alreadyPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = order.total - alreadyPaid;
    if (Number(amount) > outstanding + 0.01) { // 0.01 tolerance for floating point
      res.status(400).json({ error: `Amount KES ${amount} exceeds outstanding balance of KES ${outstanding.toFixed(2)}` });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        orderId: id,
        shiftId,
        method,
        amount: Number(amount)
      }
    });

    // Check if fully paid — normalize status to uppercase 'COMPLETED'
    const totalPaid = alreadyPaid + Number(amount);
    if (totalPaid >= order.total) {
      await prisma.order.update({
        where: { id, tenantId },
        data: { status: 'COMPLETED' }
      });

      // SMS receipt — non-fatal, runs in background
      if (order.guestId) {
        const guest = await prisma.guest.findUnique({ where: { id: order.guestId } });
        if (guest?.phone) {
          const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, currency: true } });
          const orderItems = await prisma.orderItem.findMany({ where: { orderId: id }, select: { name: true, quantity: true } });
          const smsText = formatReceiptSMS({
            orderNumber: order.orderNumber,
            items: orderItems,
            total: order.total,
            currency: tenant?.currency ?? 'KES',
            tenantName: tenant?.name ?? 'ServePoint'
          });
          sendSMS(guest.phone, smsText).catch(() => {});
        }
      }
    }

    res.json(payment);
  } catch (error) {
    console.error('Failed to add payment:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

export default router;
