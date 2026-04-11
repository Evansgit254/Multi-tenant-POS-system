import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant } from '../middleware/auth';
import { decrypt } from '../lib/encryption';

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

      // H-10 FIX: Decrypt secrets before use
      const consumerKey    = decrypt(tenant.mpesaConsumerKey)    ?? '';
      const consumerSecret = decrypt(tenant.mpesaConsumerSecret) ?? '';
      const passkey        = decrypt(tenant.mpesaPasskey)        ?? '';

      // Verify order belongs to this tenant
      const order = await prisma.order.findUnique({
        where: { id: orderId, tenantId }
      });
      if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

      const baseUrl = process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

      const token     = await getMpesaToken(consumerKey, consumerSecret);
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password  = Buffer.from(`${tenant.mpesaShortcode}${passkey}${timestamp}`).toString('base64');
      const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
      // H-7 FIX: Include a secret token in the callback URL to validate webhook authenticity
      const webhookSecret = process.env.MPESA_WEBHOOK_SECRET ?? '';
      const callbackUrl = `${serverUrl}/api/tenants/${tenantId}/mpesa/webhook${webhookSecret ? `?secret=${webhookSecret}` : ''}`;

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


export default router;
