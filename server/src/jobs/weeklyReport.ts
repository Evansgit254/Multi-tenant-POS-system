import cron from 'node-cron';
import prisma from '../lib/prisma';
import { sendEmail } from '../services/emailService';

/**
 * Core business logic that handles a single restaurant/hotel tenant instance.
 * It strictly aggregates ONLY 'completed' orders over a sliding 7-day window.
 */
const processTenantWeeklyReport = async (tenant: any) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Fetch total active revenue for the past 7 days
    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        status: 'COMPLETED',
        createdAt: { gte: oneWeekAgo },
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    
    // Fetch all active users explicitly bound to this specific tenant
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id, isActive: true },
    });

    // Strictly filter out users who chose to disable email notifications
    const subscribedUsers = users.filter((user) => {
      if (!user.preferences) return false;
      try {
        const prefs = JSON.parse(user.preferences as string);
        return prefs?.notifications?.weeklyReport?.email === true;
      } catch {
        return false;
      }
    });

    // Do nothing if no one is subscribed
    if (subscribedUsers.length === 0) return;

    // Build the dynamic currency format
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: tenant.currency || 'KES',
      }).format(amount);

    // Construct the actual HTML payload
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h2 style="color: #0f766e; margin-top: 0;">Weekly Performance Report</h2>
        <p style="font-size: 16px;">Hello from ServePoint!</p>
        <p style="font-size: 16px;">Here is the automated weekly revenue breakdown for <strong>${tenant.name}</strong> covering the last 7 days.</p>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 15px 0; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Key Metrics</h3>
          <p style="margin: 8px 0; font-size: 18px; font-weight: bold;">
            Total Orders Logged: <span style="color: #0ea5e9;">${totalOrders}</span>
          </p>
          <p style="margin: 8px 0; font-size: 18px; font-weight: bold;">
            Gross Trailing Revenue: <span style="color: #10b981;">${formatCurrency(totalRevenue)}</span>
          </p>
        </div>

        <p style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 30px;">
          You are receiving this automated email because you opted into "Weekly Reports" in your Notification Preferences. To disable this, log into the ServePoint Settings dashboard.
        </p>
      </div>
    `;

    // Dispatch emails sequentially to ensure delivery constraints aren't blown
    for (const user of subscribedUsers) {
      await sendEmail(
        user.email,
        `📊 Weekly Summary: ${tenant.name}`,
        emailHtml
      );
    }
  } catch (err) {
    console.error(`[JOBS] Critical failure processing weekly report for tenant: ${tenant.id}`, err);
  }
};

/**
 * Global Polling function that executes iterating over every restaurant inside the SaaS instance
 */
export const runWeeklyReportJob = async () => {
  console.log('[JOBS] Initiating Global Weekly Report Generation...');
  try {
    const tenants = await prisma.tenant.findMany();
    for (const tenant of tenants) {
      await processTenantWeeklyReport(tenant);
    }
    console.log('[JOBS] ✅ Global Weekly Report Sequence Completed.');
  } catch (err) {
    console.error('[JOBS] Fatal Master Error processing Weekly Reports:', err);
  }
};

/**
 * Nightly low-stock alert — emails hotel_admin users for each tenant that has
 * items below the lowStockThreshold.
 */
const runLowStockAlert = async () => {
  console.log('[CRON] Running nightly low-stock alert check...');
  try {
    const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
    for (const tenant of tenants) {
      const lowItems = await prisma.inventoryItem.findMany({
        where: {
          tenantId: tenant.id,
          currentStock: { lte: prisma.inventoryItem.fields.lowStockThreshold as any }
        }
      });
      // Prisma doesn't support column comparison directly — use raw filter
      const allItems = await prisma.inventoryItem.findMany({ where: { tenantId: tenant.id } });
      const flagged = allItems.filter(i => i.currentStock <= i.lowStockThreshold);
      if (flagged.length === 0) continue;

      const admins = await prisma.user.findMany({
        where: { tenantId: tenant.id, isActive: true, role: { in: ['hotel_admin', 'manager'] } }
      });

      const rows = flagged.map(i =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i.name}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#ef4444;">${i.currentStock} ${i.unit}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i.lowStockThreshold} ${i.unit}</td></tr>`
      ).join('');

      const html = `
        <div style="font-family:Arial,sans-serif;padding:24px;max-width:600px;">
          <h2 style="color:#ef4444;">⚠️ Low Stock Alert — ${tenant.name}</h2>
          <p>The following items are at or below their reorder threshold:</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px;text-align:left;">Item</th>
              <th style="padding:8px;text-align:left;">Current Stock</th>
              <th style="padding:8px;text-align:left;">Reorder At</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:16px;font-size:13px;color:#64748b;">Please reorder soon to avoid stockouts.</p>
        </div>`;

      for (const admin of admins) {
        await sendEmail(admin.email, `⚠️ Low Stock Alert — ${tenant.name}`, html);
      }
      console.log(`[CRON] Low-stock alert sent for tenant: ${tenant.name} (${flagged.length} items)`);
    }
    console.log('[CRON] ✅ Low-stock alert check complete.');
  } catch (err) {
    console.error('[CRON] Low-stock alert failed:', err);
  }
};

/**
 * Initializes the `node-cron` daemon inside the root application server process
 */
export const initializeCronJobs = () => {
  // Weekly Report: Every Sunday at 20:00
  cron.schedule('0 20 * * 0', () => {
    console.log('[CRON] Automatic trigger received for Sunday 8PM Weekly Report!');
    runWeeklyReportJob();
  });

  // Session Expiry Pruning: Runs nightly at 03:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] Running nightly session expiry pruning...');
    try {
      const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      });
      console.log(`[CRON] ✅ Pruned ${result.count} expired session(s).`);
    } catch (err) {
      console.error('[CRON] Failed to prune expired sessions:', err);
    }
  });

  // Low-Stock Alert: Every morning at 06:00 AM
  cron.schedule('0 6 * * *', () => {
    runLowStockAlert();
  });

  console.log('[CRON] Engine Armed: Weekly Report @ Sun 20:00 | Session Pruning @ daily 03:00 | Low-Stock Alert @ daily 06:00');
};
