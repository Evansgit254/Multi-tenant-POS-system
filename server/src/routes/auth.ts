import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendEmail } from '../services/emailService';

const router = Router();

// F-15 FIX: Rate limit login attempts to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  // M-3 FIX: Strict rate limiting in production — but allow E2E testing locally
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY FIX: Rate limit registrations to prevent tenant spam / resource exhaustion
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Too many accounts created from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signToken = (user: { id: string; tenantId: string | null; role: string }, jti: string) =>
  jwt.sign(
    { id: user.id, tenantId: user.tenantId, role: user.role, jti },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as any }
  );

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter, // F-15
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash ?? '');
    if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    // Fetch tenant info for branding
    const tenant = user.tenantId
      ? await prisma.tenant.findUnique({ where: { id: user.tenantId } })
      : null;

    // Stateful Session Generation
    const jti = crypto.randomUUID();
    const token = signToken(user, jti);

    const parser = new UAParser(req.headers['user-agent'] || '');
    const browser = parser.getBrowser().name;
    const os = parser.getOS().name;
    
    let deviceInfo = 'Unknown Device';
    if (browser && os) deviceInfo = `${browser} on ${os}`;
    else if (browser) deviceInfo = browser;
    else if (os) deviceInfo = os;

    await prisma.session.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        token: jti,
        deviceInfo,
        ipAddress: req.ip || req.socket.remoteAddress || 'Unknown IP',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hrs
      }
    });

    // Stamp lastLoginAt on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
      tenant: tenant ? { id: tenant.id, name: tenant.name, currency: tenant.currency, taxRate: tenant.taxRate } : null,
    });
  }
);

// POST /api/auth/register
router.post(
  '/register',
  registerLimiter, // SECURITY FIX: Prevent tenant spam
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty(),
    body('hotelName').notEmpty()
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    // M-4 FIX: Allow disabling self-registration via env flag (set REGISTRATION_ENABLED=false in production)
    if (process.env.REGISTRATION_ENABLED === 'false') {
      res.status(403).json({ error: 'Self-registration is disabled. Please contact your system administrator.' });
      return;
    }

    const { email, password, name, hotelName } = req.body;
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: 'User already exists' }); return; }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create Tenant
        const slug = hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000);
        const tenant = await tx.tenant.create({
          data: { name: hotelName, slug }
        });

        // Create User
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name,
            email,
            passwordHash,
            role: 'hotel_admin'
          }
        });

        const jti = crypto.randomUUID();
        return { user, tenant, token: signToken(user, jti), jti };
      });

      // Bind the new initial session for the admin who just registered
      const parser = new UAParser(req.headers['user-agent'] || '');
      const browser = parser.getBrowser().name;
      const os = parser.getOS().name;
      let deviceInfo = 'Unknown Device';
      if (browser && os) deviceInfo = `${browser} on ${os}`;
      else if (browser) deviceInfo = browser;
      else if (os) deviceInfo = os;

      await prisma.session.create({
        data: {
          userId: result.user.id,
          tenantId: result.user.tenantId,
          token: result.jti,
          deviceInfo,
          ipAddress: req.ip || req.socket.remoteAddress || 'Unknown IP',
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
        }
      });

      res.status(201).json({
        token: result.token,
        user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role, tenantId: result.user.tenantId },
        tenant: { id: result.tenant.id, name: result.tenant.name, currency: result.tenant.currency, taxRate: result.tenant.taxRate }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to register account' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, tenantId: true },
  });
  
  const tenant = user?.tenantId 
    ? await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { id: true, name: true, currency: true, taxRate: true } })
    : null;

  res.json({ user, tenant });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [body('email').isEmail()], async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    // M-1 FIX: Store a SHA-256 hash of the token, not the plaintext
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: tokenHash,
        resetTokenExpiry: new Date(Date.now() + 3600000) // 1 hr
      }
    });
    // Send the RAW token in the email link
    const resetUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/login?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 560px;">
        <h2 style="color: #0f766e;">Reset Your Password</h2>
        <p>You requested a password reset for your ServePoint account.</p>
        <p>Click the link below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
        <p style="margin-top:24px;font-size:12px;color:#64748b;">If you didn't request this, please ignore this email.</p>
      </div>`;
    try { await sendEmail(user.email, 'Reset Your ServePoint Password', html); } catch {}
  }
  
  // Always return success to prevent email enumeration
  res.json({ message: 'If an account exists, a reset link has been sent to your email.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', [body('token').notEmpty(), body('password').isLength({ min: 6 })], async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;
  
  // M-1 FIX: Hash the incoming token before comparing with the stored hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExpiry: { gt: new Date() }
    }
  });

  if (!user) { res.status(400).json({ error: 'Invalid or expired reset token' }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null }
  });

  // M-2 FIX: Invalidate all existing sessions so compromised sessions can't linger
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { isActive: false }
  });

  res.json({ message: 'Password successfully reset. You can now log in.' });
});

// POST /api/auth/oauth
// FORENSIC GAP FIX: Disabled demo OAuth auto-provisioning hole.
router.post('/oauth', [body('provider').isIn(['Google', 'Facebook'])], async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({ error: 'OAuth login is disabled for production without proper token verification. Please use standard email/password authentication.' });
});

export default router;
