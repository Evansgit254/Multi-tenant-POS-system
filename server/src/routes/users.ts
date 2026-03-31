import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/users
router.get('/', authorize('hotel_admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.tenantId },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/tenants/:tenantId/users/me/stats
router.get('/me/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const tenantId = req.params.tenantId;

    // F-12 (users): Only count properly completed orders
    const orders = await prisma.order.findMany({
      where: { tenantId, cashierId: userId, status: 'completed' },
      select: { total: true }
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true, createdAt: true }
    });

    res.json({ totalOrders, totalRevenue, lastLoginAt: user?.lastLoginAt, memberSince: user?.createdAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// GET /api/tenants/:tenantId/users/me/preferences
router.get('/me/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });

    const prefs = user?.preferences ? JSON.parse(user.preferences as string) : {};
    res.json(prefs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PATCH /api/tenants/:tenantId/users/me/preferences
router.patch('/me/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });
    const currentPrefs = existing?.preferences ? JSON.parse(existing.preferences as string) : {};
    const merged = { ...currentPrefs, ...req.body };

    const user = await prisma.user.update({
      where: { id: userId },
      data: { preferences: JSON.stringify(merged) },
      select: { preferences: true }
    });

    res.json(JSON.parse(user.preferences as string));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// PUT /api/tenants/:tenantId/users/profile
// F-6 FIX: Added email uniqueness check and graceful error handling
router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { name, email } = req.body;

    // F-6: Check if email is already used by another user
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        res.status(409).json({ error: 'This email address is already in use by another account.' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, ...(email ? { email } : {}) },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(user);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Email already in use.' });
      return;
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
