import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { UserPayload } from '../types';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const token = auth.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    const jti = decoded.jti;

    // L-2 FIX: Removed jti-less legacy fallback — all issued tokens now include jti
    // Tokens without jti cannot be revoked and should no longer be accepted
    if (!jti) {
      res.status(401).json({ error: 'Invalid token format. Please log in again.' });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token: jti },
      select: { isActive: true, expiresAt: true, user: { select: { isActive: true, role: true, tenantId: true } } }
    });
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Session was revoked or expired.' });
      return;
    }
    if (!session.user?.isActive) {
      res.status(401).json({ error: 'Account is inactive or has been deactivated.' });
      return;
    }

    // M-14 FIX: Non-super_admin accounts must be associated with a tenant
    if (decoded.role !== 'super_admin' && !decoded.tenantId) {
      res.status(403).json({ error: 'Your account is not associated with any tenant. Please contact support.' });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };

export const scopeTenant = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  let { tenantId } = req.params;
  
  if (!tenantId) {
    const match = req.originalUrl.match(/\/api\/tenants\/([^/]+)/);
    if (match) tenantId = match[1];
  }

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (user.role === 'super_admin') { next(); return; }
  
  if (String(user.tenantId) !== String(tenantId)) {
    res.status(403).json({ error: 'Access denied to this tenant' });
    return;
  }
  next();
};

// --- Permissions System ---

export const PERMISSIONS = {
  VOID_ORDER: 'VOID_ORDER',
  VIEW_REPORTS: 'VIEW_REPORTS',
  VIEW_STOCK: 'VIEW_STOCK',
  MANAGE_STOCK: 'MANAGE_STOCK',
  MANAGE_MENU: 'MANAGE_MENU',
  APPLY_DISCOUNT: 'APPLY_DISCOUNT',
  MANAGE_ROOMS: 'MANAGE_ROOMS'
};

// F-5 FIX: Added 'manager' role with full permissions (same as hotel_admin)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: Object.values(PERMISSIONS),
  hotel_admin: Object.values(PERMISSIONS),
  manager: Object.values(PERMISSIONS), // F-5: manager now has full operational permissions
  cashier: [PERMISSIONS.APPLY_DISCOUNT, PERMISSIONS.MANAGE_ROOMS, PERMISSIONS.VIEW_STOCK]
};

export const requirePermission = (permission: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    
    if (user.role === 'super_admin') { next(); return; }

    const allowedPermissions = ROLE_PERMISSIONS[user.role] || [];
    const hasPermission = allowedPermissions.includes(permission);

    if (!hasPermission) {
      res.status(403).json({ error: `Missing required permission: ${permission}` });
      return;
    }
    next();
  };
