/**
 * AI Sales Forecasting Endpoint
 *
 * Uses simple linear regression on the past 30 days of completed order revenue
 * to predict the next 7 days of sales.
 *
 * GET /api/tenants/:tenantId/forecast
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant, authorize('hotel_admin', 'manager'));

/**
 * Simple Ordinary Least Squares (OLS) linear regression.
 * Returns predicted value at x = predictAt.
 */
const linearRegression = (data: { x: number; y: number }[]): ((x: number) => number) => {
  const n = data.length;
  if (n === 0) return () => 0;

  const sumX  = data.reduce((s, d) => s + d.x, 0);
  const sumY  = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumXX = data.reduce((s, d) => s + d.x * d.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return () => sumY / n; // flat line

  const slope     = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return (x: number) => Math.max(0, slope * x + intercept);
};

// GET /api/tenants/:tenantId/forecast
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.params;

    // Fetch 30 days of completed order data as training set
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: { tenantId, status: 'COMPLETED', createdAt: { gte: startDate } },
      select: { total: true, createdAt: true }
    });

    // Aggregate into daily revenue buckets (day 0..29)
    const dailyRevenue: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dailyRevenue[d.toISOString().split('T')[0]] = 0;
    }
    orders.forEach(o => {
      const key = o.createdAt.toISOString().split('T')[0];
      if (dailyRevenue[key] !== undefined) dailyRevenue[key] += Number(o.total);
    });

    // Build regression input (x = day index, y = revenue)
    const points = Object.values(dailyRevenue).map((revenue, i) => ({ x: i, y: revenue }));
    const predict = linearRegression(points);

    // Predict next 7 days
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      forecast.push({
        date: date.toISOString().split('T')[0],
        predictedRevenue: Math.round(predict(30 + i))
      });
    }

    // Also return the 30-day actuals for chart comparison
    const actuals = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }));

    res.json({ actuals, forecast });
  } catch (err) {
    console.error('[FORECAST] Error:', err);
    res.status(500).json({ error: 'Failed to generate forecast.' });
  }
});

export default router;
