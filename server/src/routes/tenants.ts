import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET /api/tenants
router.get('/', authenticate, authorize('super_admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: { select: { users: true, orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// POST /api/tenants — Create new tenant
router.post(
  '/',
  authenticate,
  authorize('super_admin'),
  [
    body('name').notEmpty().trim(),
    body('slug').notEmpty().toLowerCase().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { name, slug, currency, taxRate } = req.body;
    try {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (existing) { res.status(409).json({ error: 'A tenant with this slug already exists.' }); return; }

      const tenant = await prisma.tenant.create({
        data: { name, slug, currency: currency || 'KES', taxRate: taxRate || 16 },
      });
      res.status(201).json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create tenant' });
    }
  }
);

// PATCH /api/tenants/:id — Update tenant
router.patch('/:id', authenticate, authorize('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, currency, taxRate, isActive, receiptFooter, loyaltyEarnRate } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name, currency, taxRate, isActive, receiptFooter, loyaltyEarnRate }
    });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// DELETE /api/tenants/:id — F-7 FIX: Soft-delete only with safety guards
router.delete('/:id', authenticate, authorize('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    // F-7: Check for unsettled charges
    const unsettledCharges = await prisma.roomCharge.count({
      where: { tenantId: req.params.id, isSettled: false }
    });
    if (unsettledCharges > 0) {
      res.status(400).json({ error: `Cannot deactivate tenant: ${unsettledCharges} room charge(s) are unsettled.` });
      return;
    }

    // F-7: Check for active orders
    const activeOrders = await prisma.order.count({
      where: {
        tenantId: req.params.id,
        status: { in: ['pending', 'preparing', 'ready'] }
      }
    });
    if (activeOrders > 0) {
      res.status(400).json({ error: `Cannot deactivate tenant: ${activeOrders} active order(s) in progress.` });
      return;
    }

    // F-7: Soft-delete instead of hard-delete
    await prisma.tenant.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ success: true, message: 'Tenant deactivated. All data preserved.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate tenant' });
  }
});

// GET /api/tenants/:id/users — Get tenant users (super admin view)
router.get('/:id/users', authenticate, authorize('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant users' });
  }
});

export default router;
