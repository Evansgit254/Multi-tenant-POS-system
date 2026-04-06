import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize, requirePermission, PERMISSIONS } from '../middleware/auth';

const router = Router({ mergeParams: true });
// FORENSIC GAP FIX: Require manager or higher role to view analytics
router.use(authenticate, scopeTenant, authorize('hotel_admin', 'manager'));

// GET /api/tenants/:tenantId/analytics/dashboard
// GAP #9 FIX: Filter to completed orders only for revenue figures
// GAP #15 FIX: Correct 'yesterday' date range to use a proper window
router.get('/dashboard', async (req, res, next) => {
  try {
    const { tenantId } = req.params as Record<string, string>;
    const { range = 'today' } = req.query;

    let startDate = new Date();
    let endDate = new Date();

    if (range === 'yesterday') {
      // GAP #15 FIX: properly set both start and end for yesterday
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'month') {
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // today
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const dateFilter = { gte: startDate, lte: endDate };

    // ── Period-over-Period Delta Engine ──────────────────────────────────
    // Mirror the window size exactly one period backwards
    const periodMs = endDate.getTime() - startDate.getTime();
    const prevEnd   = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    const prevFilter = { gte: prevStart, lte: prevEnd };

    const [prevOrders, prevGuestCount] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, status: 'COMPLETED', createdAt: prevFilter },
        select: { total: true }
      }),
      prisma.guest.count({ where: { tenantId, createdAt: prevFilter } })
    ]);

    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0);
    const prevOrderCount = prevOrders.length;
    const prevAvgTicket = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

    // Compute previous period hourly velocity for chart comparison
    const prevOrdersHourly = await prisma.order.findMany({
      where: { tenantId, status: 'COMPLETED', createdAt: prevFilter },
      select: { total: true, createdAt: true }
    });
    const prevVelocity = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    prevOrdersHourly.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      prevVelocity[hour].count += Number(o.total);
    });

    const calcDelta = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10; // 1 decimal place
    };
    // ─────────────────────────────────────────────────────────────────────

    // GAP #9 FIX: Only count completed orders in revenue calculations
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: dateFilter
      },
      include: {
        cashier: { select: { id: true, name: true, role: true } },
        items: { include: { menuItem: { select: { emoji: true, categoryId: true } } } },
        guest: { select: { id: true } }
      }
    });

    // Also fetch cancelled orders separately (for discounts context, not revenue)
    // DATA FIX: Use lowercase 'cancelled' which is how orders.ts writes it
    const cancelledOrders = await prisma.order.findMany({
      where: { tenantId, status: 'cancelled', createdAt: dateFilter }
    });
    const cancelledCount = cancelledOrders.length;
    const cancelledValue = cancelledOrders.reduce((sum, o) => sum + Number(o.total || o.subtotal), 0);

    // Live Occupancy Metrics
    const totalTables = await prisma.table.count({ where: { tenantId } });
    const activeTables = await prisma.table.count({ where: { tenantId, status: 'occupied' } });
    const totalRooms = await prisma.room.count({ where: { tenantId } });
    // DATA FIX: rooms are stored with lowercase 'occupied' status
    const activeRooms = await prisma.room.count({ where: { tenantId, status: 'occupied' } });
    
    const occupancy = {
      tables: { total: totalTables, active: activeTables },
      rooms: { total: totalRooms, active: activeRooms }
    };

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscounts = orders.reduce((sum, o) => sum + Number(o.discount || 0), 0);

    // Hourly sales curve for charts (24 buckets)
    const currentVelocity = Array.from({length: 24}, (_, i) => ({ hour: i, count: 0 }));
    orders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      currentVelocity[hour].count += Number(o.total);
    });

    const revenueDonut = {
      dineIn: orders.filter(o => o.orderType === 'dine_in').reduce((s, o) => s + Number(o.total), 0),
      takeaway: orders.filter(o => o.orderType === 'takeaway').reduce((s, o) => s + Number(o.total), 0),
      delivery: orders.filter(o => o.orderType === 'room_service').reduce((s, o) => s + Number(o.total), 0),
    };

    // Best Employees
    const employeeSales: Record<string, { name: string; role: string; sales: number; orders: number }> = {};
    orders.forEach(o => {
      if (!employeeSales[o.cashierId]) {
        employeeSales[o.cashierId] = { name: o.cashier.name, role: o.cashier.role, sales: 0, orders: 0 };
      }
      employeeSales[o.cashierId].sales += Number(o.total);
      employeeSales[o.cashierId].orders++;
    });
    const bestEmployees = Object.values(employeeSales).sort((a, b) => b.sales - a.sales).slice(0, 6);

    // Trending Dishes
    const dishSales: Record<string, { name: string; type: string; count: number; emoji: string; revenue: number }> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        if (!dishSales[item.menuItemId]) {
          dishSales[item.menuItemId] = {
            name: item.name,
            type: 'Food',
            count: 0,
            emoji: item.menuItem?.emoji || '🍽️',
            revenue: 0
          };
        }
        dishSales[item.menuItemId].count += item.quantity;
        dishSales[item.menuItemId].revenue += Number(item.subtotal);
      });
    });

    const trendingDishes = Object.values(dishSales).sort((a, b) => b.count - a.count).slice(0, 6);
    const topItems = trendingDishes.map(d => ({ name: d.name, quantity: d.count, revenue: d.revenue, emoji: d.emoji }));

    // Revenue by day
    const days = range === 'year' ? 30 : range === 'month' ? 30 : 7;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - (days - 1));
    daysAgo.setHours(0, 0, 0, 0);

    const weeklyOrders = await prisma.order.findMany({
      where: { 
        tenantId, 
        status: 'COMPLETED', // GAP #9 FIX: only completed orders
        createdAt: { gte: daysAgo } 
      },
      select: { total: true, createdAt: true }
    });

    const revMap: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(daysAgo);
      d.setDate(d.getDate() + i);
      revMap[d.toISOString().split('T')[0]] = 0;
    }
    weeklyOrders.forEach(o => {
      const dateKey = o.createdAt.toISOString().split('T')[0];
      if (revMap[dateKey] !== undefined) revMap[dateKey] += Number(o.total);
    });
    const revenueByDay = Object.entries(revMap).map(([date, revenue]) => ({ date, revenue }));

    // Low Stock
    const inventory = await prisma.inventoryItem.findMany({ where: { tenantId } });
    const lowStock = inventory.filter(i => i.currentStock <= i.lowStockThreshold).map(i => ({
      id: i.id, name: i.name, currentStock: i.currentStock, lowStockThreshold: i.lowStockThreshold, unit: i.unit
    }));

    // New guests this period
    const newGuests = await prisma.guest.count({ where: { tenantId, createdAt: dateFilter } });

    // Revenue by payment method — FORENSIC GAP FIX: Do not include payments attached to cancelled orders
    const payments = await prisma.payment.findMany({ 
      where: { tenantId, paidAt: dateFilter, order: { status: 'COMPLETED' } } 
    });
    const revenueByMethod: Record<string, number> = {};
    payments.forEach(p => {
      revenueByMethod[p.method] = (revenueByMethod[p.method] || 0) + Number(p.amount);
    });

    res.json({
      totalRevenue,
      totalOrders,
      avgOrderValue,
      totalDiscounts,
      cancelledCount,
      cancelledValue,
      occupancy,
      newGuests,
      revenueDonut,
      bestEmployees,
      trendingDishes,
      topItems,
      revenueByDay,
      revenueByMethod,
      lowStock,
      salesVelocity: { current: currentVelocity, previous: prevVelocity },
      deltas: {
        revenue:  calcDelta(totalRevenue,  prevRevenue),
        orders:   calcDelta(totalOrders,   prevOrderCount),
        avgTicket: calcDelta(avgOrderValue, prevAvgTicket),
        newGuests: calcDelta(newGuests,    prevGuestCount)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
