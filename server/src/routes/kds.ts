import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize as requireRole } from '../middleware/auth';

const router = Router({ mergeParams: true });
// F-12 FIX: Added scopeTenant to prevent cross-tenant ticket queries
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/kds/tickets
router.get('/tickets', async (req, res, next) => {
  try {
    const { tenantId } = req.params as Record<string, string>;
    
    const tickets = await prisma.orderItem.findMany({
      where: {
        order: { tenantId, status: { notIn: ['completed', 'cancelled'] } },
        kitchenStatus: { in: ['PENDING', 'PREPARING', 'READY'] }
      },
      include: {
        order: { select: { orderNumber: true, orderType: true, tableRef: true, roomId: true, createdAt: true } },
        menuItem: { select: { name: true, emoji: true } }
      },
      orderBy: { order: { createdAt: 'asc' } }
    });

    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tenants/:tenantId/kds/tickets/:orderItemId
// F-3 FIX: Verify the ticket belongs to the requesting tenant before updating
router.patch('/tickets/:orderItemId', requireRole('admin', 'manager', 'hotel_admin', 'cashier'), async (req, res, next) => {
  try {
    const { tenantId, orderItemId } = req.params as Record<string, string>;
    const schema = z.object({
      kitchenStatus: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED'])
    });
    
    const { kitchenStatus } = schema.parse(req.body);

    // F-3 FIX: Tenant ownership check before update
    const existing = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { select: { tenantId: true } } }
    });

    if (!existing) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    if (existing.order.tenantId !== tenantId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updatedTicket = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { kitchenStatus },
      include: {
        order: { select: { orderNumber: true, orderType: true, tableRef: true, roomId: true, createdAt: true } },
        menuItem: { select: { name: true, emoji: true } }
      }
    });

    res.json(updatedTicket);
  } catch (error) {
    next(error);
  }
});

export default router;
