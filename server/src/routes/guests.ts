import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize as requireRole } from '../middleware/auth';

const router = Router({ mergeParams: true });
// GAP #12 FIX: Added scopeTenant to prevent cross-tenant guest data exposure
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/guests
router.get('/', async (req, res, next) => {
  try {
    const { tenantId } = req.params as Record<string, string>;
    const guests = await prisma.guest.findMany({
      where: { tenantId },
      orderBy: { lastName: 'asc' },
    });
    res.json(guests);
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/guests
router.post('/', requireRole('admin', 'manager', 'cashier', 'hotel_admin'), async (req, res, next) => {
  try {
    const { tenantId } = req.params as Record<string, string>;
    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional().or(z.literal('')),
    });
    
    const data = schema.parse(req.body);
    const guest = await prisma.guest.create({
      data: { 
        ...data, 
        email: data.email || null,
        phone: data.phone || null,
        tenantId 
      }
    });

    res.status(201).json(guest);
  } catch (error) {
    next(error);
  }
});

// GET /api/tenants/:tenantId/guests/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const guest = await prisma.guest.findUnique({
      where: { id, tenantId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        orders: { orderBy: { createdAt: 'desc' }, take: 5 }
      }
    });
    if (!guest) {
      res.status(404).json({ error: 'Guest not found' });
      return;
    }
    res.json(guest);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tenants/:tenantId/guests/:id
router.patch('/:id', requireRole('admin', 'manager', 'cashier', 'hotel_admin'), async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const schema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional().or(z.literal('')),
    });
    
    const data = schema.parse(req.body);
    const guest = await prisma.guest.update({
      where: { id, tenantId },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
        phone: data.phone === '' ? null : data.phone,
      }
    });
    res.json(guest);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tenants/:tenantId/guests/:id
// L-8 FIX: Block guest deletion if they have associated orders (preserve history)
router.delete('/:id', requireRole('admin', 'manager', 'hotel_admin'), async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const orderCount = await prisma.order.count({ where: { guestId: id } });
    if (orderCount > 0) {
      res.status(400).json({
        error: `Cannot delete guest — they have ${orderCount} order(s) on record. Historical data would be lost.`
      });
      return;
    }
    await prisma.guest.delete({ where: { id, tenantId } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/guests/:id/loyalty/adjust
router.post('/:id/loyalty/adjust', requireRole('admin', 'manager', 'hotel_admin'), async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const schema = z.object({
      points: z.number(), // + for ADD, - for REDEEM
      notes: z.string().optional()
    });
    
    const { points, notes } = schema.parse(req.body);

    const transaction = await prisma.$transaction(async (tx) => {
      // M-12 FIX: Prevent loyalty balance from going below zero
      const currentGuest = await tx.guest.findUnique({ where: { id, tenantId } });
      if (!currentGuest) throw new Error('Guest not found');
      if (currentGuest.loyaltyPoints + points < 0) {
        throw Object.assign(
          new Error(`Insufficient loyalty points. Current balance: ${currentGuest.loyaltyPoints}`),
          { safe: true }
        );
      }

      const guest = await tx.guest.update({
        where: { id, tenantId },
        data: { loyaltyPoints: { increment: points } }
      });
      
      const loyaltyTx = await tx.loyaltyTransaction.create({
        data: {
          tenantId,
          guestId: guest.id,
          points,
          type: points > 0 ? 'ADJUSTMENT' : 'REDEEM',
          notes: notes || 'Manual adjustment'
        }
      });
      return { guest, loyaltyTx };
    });

    res.json(transaction);
  } catch (error: any) {
    if (error?.safe) { res.status(400).json({ error: error.message }); return; }
    next(error);
  }
});

export default router;
