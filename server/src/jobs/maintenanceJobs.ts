/**
 * Maintenance Jobs
 *
 * L-6: Auto-close stale OPEN shifts (open > 24 hours) and flag them for manager review.
 * L-9: Purge messages older than 90 days to prevent unbounded table growth.
 *
 * These run nightly at 02:00 server time via the scheduler in server.ts.
 *
 * To test manually (dev only):
 *   GET /api/test/maintenance
 */

import prisma from '../lib/prisma';

/**
 * L-6 FIX: Auto-close any shift that has been OPEN for more than 24 hours.
 * This prevents stale shifts from accumulating indefinitely when cashiers forget
 * to close them. The shift is marked CLOSED and flagged with a note.
 */
export const autoCloseStaleShifts = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const staleShifts = await prisma.shift.findMany({
    where: { status: 'OPEN', startTime: { lt: cutoff } },
    include: { payments: true }
  });

  if (staleShifts.length === 0) return;

  console.log(`[Maintenance] Auto-closing ${staleShifts.length} stale shift(s)...`);

  for (const shift of staleShifts) {
    let cashTotal = 0;
    let cardTotal = 0;
    let mpesaTotal = 0;

    for (const p of shift.payments) {
      if (p.method === 'cash')  cashTotal  += p.amount;
      else if (p.method === 'card')  cardTotal  += p.amount;
      else if (p.method === 'mpesa') mpesaTotal += p.amount;
    }

    const expectedCash = shift.startingFloat + cashTotal;

    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        status: 'CLOSED',
        endTime: new Date(),
        expectedCash,
        cardTotal,
        mpesaTotal,
        notes: `${shift.notes ? shift.notes + '\n' : ''}[AUTO-CLOSED] Shift was open for more than 24 hours. Please review with the cashier.`
      }
    });

    console.log(`[Maintenance] Auto-closed shift ${shift.id} (cashier: ${shift.cashierId})`);
  }
};

/**
 * L-9 FIX: Delete messages older than 90 days to prevent unbounded table growth.
 * In active hotels with 50+ staff, the Message table can grow very fast.
 */
export const purgeOldMessages = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  const result = await prisma.message.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });

  if (result.count > 0) {
    console.log(`[Maintenance] Purged ${result.count} message(s) older than 90 days.`);
  }
};

/**
 * Master function that runs all nightly maintenance tasks.
 */
export const runMaintenanceJobs = async (): Promise<void> => {
  console.log('[Maintenance] Starting nightly maintenance jobs...');
  try { await autoCloseStaleShifts(); } catch (e) { console.error('[Maintenance] autoCloseStaleShifts error:', e); }
  try { await purgeOldMessages(); }     catch (e) { console.error('[Maintenance] purgeOldMessages error:', e); }
  console.log('[Maintenance] Nightly maintenance complete.');
};
