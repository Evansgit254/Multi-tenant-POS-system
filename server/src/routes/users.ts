import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
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
      where: { tenantId, cashierId: userId, status: 'COMPLETED' },
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

// GET /api/tenants/:tenantId/users/me/sessions
router.get('/me/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const currentJti = (req as any).user.jti;

    const sessions = await prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, token: true }
    });

    const mapped = sessions.map((s: any) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      isCurrent: s.token === currentJti
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// DELETE /api/tenants/:tenantId/users/me/sessions/:sessionId
router.delete('/me/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      res.status(404).json({ error: 'Session not found or already deleted' });
      return;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false }
    });

    res.json({ message: 'Session permanently revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
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

// POST /api/tenants/:tenantId/users
router.post('/', authorize('hotel_admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId: req.params.tenantId,
        name,
        email,
        passwordHash,
        role: role || 'cashier',
        isActive: true
      },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/tenants/:tenantId/users/:id
router.patch('/:id', authorize('hotel_admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
    }

    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;

    const user = await prisma.user.update({
      where: { id, tenantId: req.params.tenantId },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PATCH /api/tenants/:tenantId/users/:id/password
router.patch('/:id/password', authorize('hotel_admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id, tenantId: req.params.tenantId },
      data: { passwordHash }
    });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/tenants/:tenantId/users/:id
router.delete('/:id', authorize('hotel_admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (id === (req as any).user.id) {
      res.status(403).json({ error: 'Cannot delete your own account' });
      return;
    }

    await prisma.user.delete({
      where: { id, tenantId: req.params.tenantId }
    });
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
