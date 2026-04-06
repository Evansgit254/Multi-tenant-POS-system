import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant, authorize('super_admin', 'hotel_admin', 'manager'));

// GET /api/tenants/:tenantId/reports/summary (Dashboard stats)
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.params.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const orders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: today }, status: 'COMPLETED' }, // F-8 FIX: completed only
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
  const { from, to, page, limit, format } = req.query;
  let toDate: Date | undefined;
  if (to) {
    toDate = new Date(to as string);
    toDate.setHours(23, 59, 59, 999);
  }
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
          lte: toDate,
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

    if (format === 'csv') {
      const header = "Date,Order Number,Type,Room/Guest,Items,Total,Payment Method,Cashier";
      const rows = orders.map(o => {
        const date = new Date(o.createdAt).toLocaleString();
        const num = o.orderNumber;
        const type = o.orderType.replace('_', ' ');
        const customer = (o as any).room?.number ? `Room ${(o as any).room.number}` : '-';
        const items = o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(' | ');
        const total = o.total;
        const methods = o.payments.map((p: any) => p.method).join(' + ');
        const cashier = o.cashier.name;
        
        const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
        return `${escape(date)},${escape(num)},${escape(type)},${escape(customer)},${escape(items)},${total},${escape(methods)},${escape(cashier)}`;
      });
      
      const csv = [header, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=ServePoint-Orders-${from || 'All'}.csv`);
      res.send(csv);
      return;
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

// GET /api/tenants/:tenantId/reports/shift-summary
router.get('/shift-summary', async (req: Request, res: Response): Promise<void> => {
  const { from, to } = req.query;

  // DATA FIX: Validate date strings before passing to Prisma to prevent invalid Date objects
  const isValidDate = (d: unknown) => typeof d === 'string' && !isNaN(Date.parse(d));
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
    res.status(400).json({ error: 'Invalid date format. Use ISO 8601 (e.g. 2026-04-01).' });
    return;
  }

  let toDate: Date | undefined;
  if (to) {
    toDate = new Date(to as string);
    toDate.setHours(23, 59, 59, 999);
  }
  const tenantId = req.params.tenantId;

  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: from ? new Date(from as string) : undefined,
          lte: toDate,
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
      if (o.status === 'CANCELLED') {
        summary.voidedCount++;
        summary.voidedAmount += Number(o.subtotal) + Number(o.taxAmount);
        return;
      }

      // Only count completed or partially_paid
      if (o.status !== 'COMPLETED' && o.status !== 'PARTIALLY_PAID') return;

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
  let toDate: Date | undefined;
  if (to) {
    toDate = new Date(to as string);
    toDate.setHours(23, 59, 59, 999);
  }
  const tenantId = req.params.tenantId;

  try {
    const where = {
      tenantId,
      status: { in: ['COMPLETED', 'PARTIALLY_PAID'] },
      createdAt: {
        gte: from ? new Date(from as string) : undefined,
        lte: toDate,
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
  const { format } = req.query;
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

    if (format === 'csv') {
      const header = "Item,Unit Cost,Available Stock,Total Asset Value";
      const rows = valuationDetails.map(i => {
        const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
        return `${escape(i.name)},${i.costPrice},${escape(i.currentStock + ' ' + i.category)},${i.totalValue}`;
      });
      const csv = [header, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=ServePoint-Inventory-Valuation.csv');
      res.send(csv);
      return;
    }

    res.json({ totalValuation, items: valuationDetails });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate inventory valuation' });
  }
});

// GET /api/tenants/:tenantId/reports/pnl
router.get('/pnl', async (req: Request, res: Response): Promise<void> => {
  const { days = 30 } = req.query;
  const tenantId = req.params.tenantId;

  const numDays = Number(days);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - numDays);
  startDate.setHours(0, 0, 0, 0);

  try {
    // 1. Fetch Revenue (Sales)
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'PARTIALLY_PAID'] },
        createdAt: { gte: startDate }
      },
      select: { total: true, createdAt: true }
    });

    // 2. Fetch Expenses (Procurement)
    const expenses = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: ['received', 'RECEIVED', 'paid', 'PAID'] },
        orderDate: { gte: startDate }
      },
      select: { totalAmount: true, orderDate: true, receiveDate: true, createdAt: true }
    });

    // 3. Build Daily Array
    const dailyMap: Record<string, { revenue: number, expenses: number }> = {};
    for (let i = 0; i < numDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dailyMap[d.toISOString().split('T')[0]] = { revenue: 0, expenses: 0 };
    }

    orders.forEach(o => {
        const dateKey = o.createdAt.toISOString().split('T')[0];
        if (dailyMap[dateKey]) dailyMap[dateKey].revenue += Number(o.total || 0);
    });

    expenses.forEach(e => {
        const dateKey = (e.receiveDate || e.orderDate || e.createdAt).toISOString().split('T')[0];
        if (dailyMap[dateKey]) dailyMap[dateKey].expenses += Number(e.totalAmount || 0);
    });

    const dailyTrend = Object.entries(dailyMap).map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue),
        expenses: Math.round(data.expenses),
        profit: Math.round(data.revenue - data.expenses)
    }));

    // 4. Summarize
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 5. Current COGS (Total Inventory Asset Value) for context
    const inventory = await prisma.inventoryItem.findMany({ where: { tenantId }});
    const totalAssetsOnHand = inventory.reduce((sum, i) => sum + (Number(i.currentStock) * Number(i.costPrice)), 0);

    res.json({
        totalRevenue: Math.round(totalRevenue),
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(netProfit),
        netMargin: Math.round(netMargin),
        totalAssetsOnHand: Math.round(totalAssetsOnHand),
        dailyTrend
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate P&L report' });
  }
});

export default router;
