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
  const { from, to, page, limit } = req.query;
  const tenantId = req.params.tenantId;

  // FORENSIC GAP FIX: Implemented hard ceiling block to prevent array memory overflows
  const take = Math.min(Number(limit) || 100, 500); 
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

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
      orderBy: { createdAt: 'desc' },
      take,
      skip
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
      // FORENSIC GAP FIX: Removed double-counting (discountFixed + percentage are already folded into o.discount)
      summary.totalDiscounts += Number(o.discount);
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
    const where = {
      tenantId,
      status: { in: ['completed', 'partially_paid'] },
      createdAt: {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined,
      },
    };

    // FORENSIC GAP FIX: Out-of-memory array mapping swapped for native SQLite aggregation
    const aggregates = await prisma.order.aggregate({
      where,
      _sum: { subtotal: true, taxAmount: true },
      _count: { id: true }
    });

    res.json({ 
      taxableSales: aggregates._sum.subtotal || 0, 
      taxCollected: aggregates._sum.taxAmount || 0, 
      orderCount: aggregates._count.id 
    });
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
