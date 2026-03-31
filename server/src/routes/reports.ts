import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant, authorize('super_admin', 'hotel_admin'));

// GET /api/tenants/:tenantId/reports/summary (Dashboard stats)
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.params.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const orders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: today }, status: 'completed' }, // F-8 FIX: completed only
      include: { payments: true }
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const byPaymentMethod: Record<string, number> = {};
    const byOrderType: Record<string, number> = {};

    orders.forEach(o => {
      byOrderType[o.orderType] = (byOrderType[o.orderType] || 0) + 1;
      o.payments.forEach(p => {
        byPaymentMethod[p.method] = (byPaymentMethod[p.method] || 0) + Number(p.amount);
      });
    });

    res.json({
      totalRevenue,
      totalOrders: orders.length,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      byPaymentMethod,
      byOrderType
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// GET /api/tenants/:tenantId/reports/orders (Detailed history)
router.get('/orders', async (req: Request, res: Response): Promise<void> => {
  const { from, to } = req.query;
  const tenantId = req.params.tenantId;

  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: from ? new Date(from as string) : undefined,
          lte: to ? new Date(to as string) : undefined,
        },
      },
      include: { 
        items: true, 
        payments: true,
        cashier: { select: { name: true } },
        room: { select: { number: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

// GET /api/tenants/:tenantId/reports/shift-summary
router.get('/shift-summary', async (req: Request, res: Response): Promise<void> => {
  const { from, to } = req.query;
  const tenantId = req.params.tenantId;

  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: from ? new Date(from as string) : undefined,
          lte: to ? new Date(to as string) : undefined,
        },
      },
      include: { payments: true }
    });

    const summary = {
      grossSales: 0,
      netSales: 0,
      totalDiscounts: 0,
      totalTax: 0,
      voidedCount: 0,
      voidedAmount: 0,
      completedCount: 0,
      byPaymentMethod: {} as Record<string, number>
    };

    orders.forEach(o => {
      if (o.status === 'cancelled') {
        summary.voidedCount++;
        summary.voidedAmount += Number(o.subtotal) + Number(o.taxAmount);
        return;
      }

      // Only count completed or partially_paid
      if (o.status !== 'completed' && o.status !== 'partially_paid') return;

      summary.completedCount++;
      summary.grossSales += Number(o.subtotal) + Number(o.taxAmount);
      summary.netSales += Number(o.total);
      summary.totalDiscounts += Number(o.discount) + Number(o.discountFixed) + (Number(o.subtotal) * (Number(o.discountPercent)/100));
      summary.totalTax += Number(o.taxAmount);

      o.payments.forEach(p => {
        summary.byPaymentMethod[p.method] = (summary.byPaymentMethod[p.method] || 0) + Number(p.amount);
      });
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate shift summary' });
  }
});

// GET /api/tenants/:tenantId/reports/taxes
router.get('/taxes', async (req: Request, res: Response): Promise<void> => {
  const { from, to } = req.query;
  const tenantId = req.params.tenantId;

  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['completed', 'partially_paid'] },
        createdAt: {
          gte: from ? new Date(from as string) : undefined,
          lte: to ? new Date(to as string) : undefined,
        },
      },
      select: { subtotal: true, taxAmount: true, createdAt: true }
    });

    let taxableSales = 0;
    let taxCollected = 0;
    
    orders.forEach(o => {
      taxableSales += Number(o.subtotal);
      taxCollected += Number(o.taxAmount);
    });

    res.json({ taxableSales, taxCollected, orderCount: orders.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate tax report' });
  }
});

// GET /api/tenants/:tenantId/reports/inventory-valuation
router.get('/inventory-valuation', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.params.tenantId;

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });

    let totalValuation = 0;
    const valuationDetails = items.map(item => {
      const value = item.currentStock * item.costPrice;
      totalValuation += value;
      return {
        id: item.id,
        name: item.name,
        category: item.unit, // Reusing unit for generic display
        currentStock: item.currentStock,
        costPrice: item.costPrice,
        totalValue: value
      };
    });

    res.json({ totalValuation, items: valuationDetails });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate inventory valuation' });
  }
});

export default router;
