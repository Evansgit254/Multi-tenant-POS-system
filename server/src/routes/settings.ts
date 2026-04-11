import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, scopeTenant } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/encryption';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant, authorize('hotel_admin'));

// GET /api/tenants/:tenantId/settings
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      // Never expose raw M-Pesa secrets to the client
      select: {
        id: true, name: true, slug: true, currency: true, taxRate: true,
        loyaltyEarnRate: true, receiptFooter: true, isActive: true,
        logoUrl: true, createdAt: true, updatedAt: true,
        // Only expose shortcode/till for display — never raw API secrets
        mpesaTillDisplay: true,
        mpesaShortcode: true,
        // C-2 FIX: Never expose raw API key — return presence flag only
        mpesaConsumerKey: true,  // used below for boolean check, stripped from response
      }
    });
    if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
    // C-2 FIX: Strip raw key, expose only a boolean flag
    const { mpesaConsumerKey, ...safeSettings } = tenant as any;
    res.json({ ...safeSettings, mpesaIsConfigured: !!mpesaConsumerKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/tenants/:tenantId/settings
// F-2 FIX: Explicitly whitelist allowed fields — prevents mass-assignment attacks
router.patch('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, currency, taxRate, loyaltyEarnRate, receiptFooter } = req.body;

    const data: Record<string, any> = {};
    if (name !== undefined) data.name = String(name);
    if (currency !== undefined) data.currency = String(currency);
    if (taxRate !== undefined) data.taxRate = Number(taxRate);
    if (loyaltyEarnRate !== undefined) data.loyaltyEarnRate = Number(loyaltyEarnRate);
    if (receiptFooter !== undefined) data.receiptFooter = String(receiptFooter);

    const tenant = await prisma.tenant.update({
      where: { id: req.params.tenantId },
      data
    });
    res.json(tenant);
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// PATCH /api/tenants/:tenantId/settings/mpesa
// Whitelisted separately to only allow M-Pesa credential updates
// H-10 FIX: All sensitive secrets are encrypted with AES-256-GCM before storage
router.patch('/mpesa', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mpesaConsumerKey, mpesaConsumerSecret, mpesaShortcode, mpesaPasskey, mpesaTillDisplay } = req.body;

    const data: Record<string, any> = {};
    // H-10 FIX: Encrypt sensitive secrets before writing to DB
    if (mpesaConsumerKey !== undefined)    data.mpesaConsumerKey    = mpesaConsumerKey    ? encrypt(String(mpesaConsumerKey))    : null;
    if (mpesaConsumerSecret !== undefined) data.mpesaConsumerSecret = mpesaConsumerSecret ? encrypt(String(mpesaConsumerSecret)) : null;
    if (mpesaShortcode !== undefined)      data.mpesaShortcode      = mpesaShortcode      ? String(mpesaShortcode)               : null; // Shortcode is not secret
    if (mpesaPasskey !== undefined)        data.mpesaPasskey        = mpesaPasskey        ? encrypt(String(mpesaPasskey))        : null;
    if (mpesaTillDisplay !== undefined)    data.mpesaTillDisplay    = mpesaTillDisplay    ? String(mpesaTillDisplay)            : null;

    await prisma.tenant.update({
      where: { id: req.params.tenantId },
      data
    });

    // Return only config status, never raw secrets
    const isConfigured = !!(mpesaConsumerKey && mpesaShortcode);
    res.json({ success: true, isConfigured });
  } catch (error) {
    console.error('M-Pesa settings update error:', error);
    res.status(500).json({ error: 'Failed to update M-Pesa settings' });
  }
});

export default router;
