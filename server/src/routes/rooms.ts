import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/rooms
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await prisma.room.findMany({
      where: { tenantId: req.params.tenantId },
      // GAP #14 FIX: Cast number to integer for proper numeric sort
      orderBy: { number: 'asc' },
      include: {
        roomCharges: {
          include: { order: true }
        }
      }
    });
    // GAP #14 FIX: Sort numerically on the application layer for mixed string rooms
    rooms.sort((a, b) => {
      const numA = parseInt(a.number.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.number.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// POST /api/tenants/:tenantId/rooms
router.post(
  '/',
  authorize('hotel_admin', 'manager'),
  [
    body('number').notEmpty(),
    body('type').notEmpty()
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { tenantId } = req.params;
      const { number, type, floor, tariff } = req.body;

      const existing = await prisma.room.findFirst({
        where: { tenantId, number }
      });

      if (existing) {
        res.status(400).json({ error: 'Room number already exists' });
        return;
      }

      const room = await prisma.room.create({
        data: {
          tenantId,
          number,
          type,
          floor: floor ? Number(floor) : null,
          tariff: tariff ? Number(tariff) : 0,
          status: 'available'
        }
      });
      res.json(room);
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  }
);

// GAP #16 FIX: Add DELETE /rooms/:id
router.delete(
  '/:id',
  authorize('hotel_admin', 'manager'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, id } = req.params;
      
      // Guard: do not delete occupied rooms
      const room = await prisma.room.findUnique({ where: { id, tenantId } });
      if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
      if (room.status === 'occupied') {
        res.status(400).json({ error: 'Cannot delete an occupied room. Check out the guest first.' });
        return;
      }

      // Guard: do not delete rooms with unsettled charges
      const unsettled = await prisma.roomCharge.count({ where: { roomId: id, isSettled: false } });
      if (unsettled > 0) {
        res.status(400).json({ error: 'Room has unsettled charges. Settle them before deleting.' });
        return;
      }

      await prisma.room.delete({ where: { id, tenantId } });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  }
);

// PATCH /api/tenants/:tenantId/rooms/:id/status
router.patch(
  '/:id/status',
  authorize('hotel_admin', 'cashier'),
  [body('status').isIn(['available', 'occupied', 'maintenance'])],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { guestName, checkedInAt } = req.body;
      const room = await prisma.room.update({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        data: { 
          status: req.body.status as any,
          ...(guestName !== undefined ? { guestName } : {}),
          ...(checkedInAt !== undefined ? { checkedInAt: checkedInAt ? new Date(checkedInAt) : null } : {})
        },
      });
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update room status' });
    }
  }
);

// GET /api/tenants/:tenantId/rooms/:id/tab
router.get('/:id/tab', async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      where: { 
        roomId: req.params.id, 
        tenantId: req.params.tenantId,
        status: { in: ['pending', 'preparing', 'ready'] }
      },
      include: {
        items: { include: { menuItem: true } },
        payments: true
      }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room tab' });
  }
});

// POST /api/tenants/:tenantId/rooms/:id/checkout
// GAP #1 PARTIAL FIX: Include accommodation charge in settlement
router.post(
  '/:id/checkout',
  authorize('hotel_admin', 'cashier'),
  [body('method').isIn(['cash', 'card', 'mpesa'])],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { tenantId, id } = req.params;
      const { method } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Get unsettled room charges (F&B from POS)
        const charges = await tx.roomCharge.findMany({
          where: { tenantId, roomId: id, isSettled: false }
        });

        // 2. Settle F&B room charges
        let totalSettled = 0;
        for (const charge of charges) {
          await tx.payment.create({
            data: {
              tenantId,
              orderId: charge.orderId,
              method,
              amount: charge.amount,
              roomId: id,
            }
          });
          await tx.order.update({
            where: { id: charge.orderId },
            data: { status: 'COMPLETED' }
          });
          totalSettled += charge.amount;
        }

        // 3. Mark F&B charges as settled
        await tx.roomCharge.updateMany({
          where: { tenantId, roomId: id, isSettled: false },
          data: { isSettled: true, settledAt: new Date() }
        });

        // 4. Free the room
        await tx.room.update({
          where: { id, tenantId },
          data: {
            status: 'available',
            guestName: null,
            checkedInAt: null
          }
        });

        return { totalSettled };
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: 'Failed to process checkout' });
    }
  }
);

// --- Bookings ---

// GET /api/tenants/:tenantId/rooms/bookings
router.get('/bookings', async (req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { tenantId: req.params.tenantId },
      include: { room: true },
      orderBy: { checkIn: 'asc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST /api/tenants/:tenantId/rooms/bookings
router.post('/bookings', authorize('hotel_admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const { roomId, guestName, guestId, checkIn, checkOut, totalPrice, notes } = req.body;

    // FORENSIC GAP FIX: Ensure room belongs to the tenant
    const room = await prisma.room.findUnique({ where: { id: roomId, tenantId } });
    if (!room) {
      res.status(400).json({ error: 'Invalid room selected.' });
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // FORENSIC GAP FIX: Check for date overlaps to prevent double booking!
    const overlap = await prisma.booking.findFirst({
      where: {
        roomId,
        tenantId,
        status: { in: ['confirmed', 'checked_in'] },
        AND: [
          { checkIn: { lt: checkOutDate } },
          { checkOut: { gt: checkInDate } }
        ]
      }
    });

    if (overlap) {
      res.status(409).json({ error: 'This room is already booked during the selected dates.' });
      return;
    }

    const booking = await prisma.booking.create({
      data: {
        tenantId,
        roomId,
        guestId,
        guestName,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice: Number(totalPrice),
        notes,
        status: 'confirmed'
      },
      include: { room: true }
    });
    res.json(booking);
  } catch (error) {
    console.error('Failed to create booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PATCH /api/tenants/:tenantId/rooms/bookings/:id
router.patch('/bookings/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, id } = req.params;
    const { status, notes } = req.body;

    const booking = await prisma.booking.update({
      where: { id, tenantId },
      data: { status, notes }
    });
    res.json(booking);
  } catch (error) {
    console.error('Failed to update booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// GAP #3 FIX: POST /bookings/:id/check-in — atomically updates Booking + Room
router.post('/bookings/:id/check-in', authorize('hotel_admin', 'cashier'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id, tenantId },
      include: { room: true }
    });

    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status === 'checked_in') { res.status(400).json({ error: 'Guest already checked in' }); return; }
    if (booking.room.status === 'occupied') { res.status(400).json({ error: 'Room is already occupied' }); return; }

    await prisma.$transaction(async (tx) => {
      // Update booking status
      await tx.booking.update({
        where: { id },
        data: { status: 'checked_in' }
      });

      // Update room: mark as occupied and set guest info
      await tx.room.update({
        where: { id: booking.roomId, tenantId },
        data: {
          status: 'occupied',
          guestName: booking.guestName,
          checkedInAt: new Date()
        }
      });
    });

    res.json({ success: true, message: `${booking.guestName} checked into Room ${booking.room.number}` });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in guest' });
  }
});

export default router;
