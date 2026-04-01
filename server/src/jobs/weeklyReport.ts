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
 * Initializes the `node-cron` daemon inside the root application server process
 */
export const initializeCronJobs = () => {
  // Standard Production Cron Schedule: Every Sunday at 20:00 (8:00 PM)
  // Format: "minute hour dayOfMonth month dayOfWeek" -> "0 20 * * 0"
  cron.schedule('0 20 * * 0', () => {
    console.log('[CRON] Automatic trigger received for Sunday 8PM Weekly Report!');
    runWeeklyReportJob();
  });

  // Session Expiry Pruning: Runs nightly at 03:00 AM to delete expired sessions
  // Prevents unbounded Session table growth from stale JTI tokens
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
  
  console.log('[CRON] Engine Armed: Weekly Report @ Sun 20:00 | Session Pruning @ daily 03:00');
};
