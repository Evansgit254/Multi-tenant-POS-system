import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/shifts/current
router.get('/current', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const cashierId = req.user.id;

    const shift = await prisma.shift.findFirst({
      where: {
        tenantId,
        cashierId,
        status: 'OPEN'
      },
      include: {
        orders: true,
        payments: true
      }
    });

    res.json(shift || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current shift' });
  }
});

// POST /api/tenants/:tenantId/shifts/open
router.post(
  '/open',
  authorize('hotel_admin', 'manager', 'cashier'),
  [body('startingFloat').isNumeric()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { tenantId } = req.params;
      const cashierId = req.user.id;
      const { startingFloat, notes } = req.body;

      // Check for existing open shift
      const existing = await prisma.shift.findFirst({
        where: { tenantId, cashierId, status: 'OPEN' }
      });
      if (existing) {
        res.status(400).json({ error: 'You already have an open shift. Please close it first.' });
        return;
      }

      const shift = await prisma.shift.create({
        data: {
          tenantId,
          cashierId,
          startingFloat: Number(startingFloat),
          notes,
          status: 'OPEN'
        }
      });

      res.status(201).json(shift);
    } catch (error) {
      console.error('Failed to open shift:', error);
      res.status(500).json({ error: 'Failed to open shift' });
    }
  }
);

// POST /api/tenants/:tenantId/shifts/:id/close
router.post(
  '/:id/close',
  authorize('hotel_admin', 'manager', 'cashier'),
  [body('actualCash').isNumeric()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { tenantId, id } = req.params;
      const cashierId = req.user.id;
      const { actualCash, notes } = req.body;

      const shift = await prisma.shift.findUnique({
        where: { id, tenantId },
        include: { payments: true }
      });

      if (!shift) { res.status(404).json({ error: 'Shift not found' }); return; }
      if (shift.status === 'CLOSED') { res.status(400).json({ error: 'Shift is already closed' }); return; }
      // M-10 FIX: Allow managers and hotel_admin to close any shift (e.g., when cashier forgets)
      if (shift.cashierId !== cashierId && !['hotel_admin', 'manager'].includes(req.user.role)) {
        res.status(403).json({ error: 'You are not authorized to close this shift' }); return;
      }

      // Calculate totals definitively from securely linked Payments
      let cashTotal = 0;
      let cardTotal = 0;
      let mpesaTotal = 0;

      for (const p of shift.payments) {
        if (p.method === 'cash') cashTotal += p.amount;
        else if (p.method === 'card') cardTotal += p.amount;
        else if (p.method === 'mpesa') mpesaTotal += p.amount;
      }

      const expectedCash = shift.startingFloat + cashTotal;

      const closedShift = await prisma.shift.update({
        where: { id },
        data: {
          status: 'CLOSED',
          endTime: new Date(),
          actualCash: Number(actualCash),
          expectedCash,
          cardTotal,
          mpesaTotal,
          notes: notes ? `${shift.notes ? shift.notes + '\n' : ''}Closing Note: ${notes}` : shift.notes
        }
      });

      res.json(closedShift);
    } catch (error) {
      console.error('Failed to close shift:', error);
      res.status(500).json({ error: 'Failed to close shift' });
    }
  }
);

export default router;
