import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getMpesaToken = async (consumerKey: string, consumerSecret: string): Promise<string> => {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const baseUrl = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const res = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) throw new Error(`Failed to get M-Pesa token: ${res.statusText}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
};

const formatPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) return `254${clean.slice(1)}`;
  if (clean.startsWith('+')) return clean.slice(1);
  return clean;
};

// ─── GET /mpesa/status ── Check if STK Push is configured for this tenant ─────
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      select: {
        mpesaShortcode: true,
        mpesaTillDisplay: true,
        mpesaConsumerKey: true
      }
    });

    const isConfigured = !!(
      tenant?.mpesaConsumerKey &&
      tenant?.mpesaShortcode
    );

    res.json({
      isConfigured,
      tillDisplay: tenant?.mpesaTillDisplay || tenant?.mpesaShortcode || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check M-Pesa status' });
  }
});

// ─── POST /mpesa/stk-push ─────────────────────────────────────────────────────
router.post(
  '/stk-push',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('orderId').notEmpty().withMessage('Order ID is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const { tenantId } = req.params;
      const { phone, amount, orderId } = req.body;

      // Load tenant's own M-Pesa credentials
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          mpesaConsumerKey: true,
          mpesaConsumerSecret: true,
          mpesaShortcode: true,
          mpesaPasskey: true
        }
      });

      if (!tenant?.mpesaConsumerKey || !tenant?.mpesaConsumerSecret || !tenant?.mpesaShortcode || !tenant?.mpesaPasskey) {
        res.status(400).json({
          error: 'M-Pesa STK Push is not configured for this hotel. Please set up M-Pesa credentials in Settings.'
        });
        return;
      }

      // Verify order belongs to this tenant
      const order = await prisma.order.findUnique({
        where: { id: orderId, tenantId }
      });
      if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

      const baseUrl = process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

      const token     = await getMpesaToken(tenant.mpesaConsumerKey, tenant.mpesaConsumerSecret);
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password  = Buffer.from(`${tenant.mpesaShortcode}${tenant.mpesaPasskey}${timestamp}`).toString('base64');
      const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
      const callbackUrl = `${serverUrl}/api/tenants/${tenantId}/mpesa/webhook`;

      const payload = {
        BusinessShortCode: tenant.mpesaShortcode,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerPayBillOnline',
        Amount:            Math.ceil(Number(amount)),
        PartyA:            formatPhone(phone),
        PartyB:            tenant.mpesaShortcode,
        PhoneNumber:       formatPhone(phone),
        CallBackURL:       callbackUrl,
        AccountReference:  order.orderNumber,
        TransactionDesc:   `Payment for order ${order.orderNumber}`
      };

      const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await stkRes.json() as Record<string, unknown>;
      if (!stkRes.ok || result.ResponseCode !== '0') {
        res.status(400).json({ error: 'STK Push rejected by Safaricom', details: result });
        return;
      }

      res.json({
        success: true,
        checkoutRequestId: result.CheckoutRequestID,
        message: 'STK Push sent. Awaiting customer PIN entry...'
      });
    } catch (error) {
      console.error('M-Pesa STK Push error:', error);
      res.status(500).json({ error: 'Failed to initiate M-Pesa payment' });
    }
  }
);

// ─── POST /mpesa/webhook ── Safaricom async payment confirmation ───────────────
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.params;
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
      await prisma.payment.create({
        data: { tenantId, orderId: order.id, method: 'mpesa', amount: Number(amountPaid), reference: mpesaCode }
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' }
      });
      console.log(`✅ M-Pesa confirmed: ${mpesaCode} for order ${accountRef}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Received successfully.' });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    res.json({ ResultCode: 0 }); // Always ACK to Safaricom to prevent retries
  }
});

export default router;
