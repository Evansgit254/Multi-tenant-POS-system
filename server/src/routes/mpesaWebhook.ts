/**
 * Public M-Pesa Webhook Router
 * 
 * This router intentionally has NO authentication middleware.
 * Safaricom's callback servers initiate POST requests to this endpoint
 * without any JWT token. Security is enforced instead by the MPESA_WEBHOOK_SECRET
 * query parameter that is embedded in the callback URL during STK Push initiation.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router({ mergeParams: true });

// POST /api/tenants/:tenantId/mpesa/webhook
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.params;

    // H-7 FIX: Validate webhook secret to prevent fake payment injections
    const expectedSecret = process.env.MPESA_WEBHOOK_SECRET;
    if (expectedSecret) {
      const receivedSecret = req.query.secret as string;
      if (receivedSecret !== expectedSecret) {
        console.warn(`[M-Pesa] Webhook received with invalid secret from ${req.ip}`);
        res.json({ ResultCode: 0 }); return; // ACK but ignore
      }
    }

    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) { res.json({ ResultCode: 0 }); return; }

    const resultCode = stkCallback.ResultCode;
    const items      = stkCallback.CallbackMetadata?.Item || [];
    const accountRef = items.find((i: any) => i.Name === 'AccountReference')?.Value;
    const mpesaCode  = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
    const amountPaid = items.find((i: any) => i.Name === 'Amount')?.Value;

    if (resultCode !== 0) {
      console.log(`M-Pesa payment cancelled/failed for order ${accountRef}: code ${resultCode}`);
      res.json({ ResultCode: 0 }); return;
    }

    const order = await prisma.order.findFirst({
      where: { tenantId, orderNumber: accountRef }
    });

    if (order && order.status !== 'COMPLETED') {
      const paid = Number(amountPaid);

      // H-8 FIX: Validate that amount paid covers the order total
      if (paid < order.total - 1) { // 1 KES tolerance for rounding
        console.warn(`[M-Pesa] Underpayment on order ${accountRef}: expected ${order.total}, got ${paid}. Recording partial payment.`);
        await prisma.payment.create({
          data: { tenantId, orderId: order.id, method: 'mpesa', amount: paid, reference: mpesaCode }
        });
        // Do NOT mark COMPLETED — let cashier reconcile
      } else {
        await prisma.payment.create({
          data: { tenantId, orderId: order.id, method: 'mpesa', amount: paid, reference: mpesaCode }
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' }
        });
        console.log(`✅ M-Pesa confirmed: ${mpesaCode} for order ${accountRef}`);
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Received successfully.' });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    res.json({ ResultCode: 0 }); // Always ACK to Safaricom to prevent retries
  }
});

export default router;
