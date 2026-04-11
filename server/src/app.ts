import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { runWeeklyReportJob } from './jobs/weeklyReport';
import { runMaintenanceJobs } from './jobs/maintenanceJobs';

import authRouter from './routes/auth';
import tenantsRouter from './routes/tenants';
import usersRouter from './routes/users';
import menuRouter from './routes/menu';
import roomsRouter from './routes/rooms';
import ordersRouter from './routes/orders';
import reportsRouter from './routes/reports';
import settingsRouter from './routes/settings';
import inventoryRouter from './routes/inventory';
import guestsRouter from './routes/guests';
import kdsRouter from './routes/kds';
import analyticsRouter from './routes/analytics';
import messagesRouter from './routes/messages';
import tablesRouter from './routes/tables';
import procurementRouter from './routes/procurement';
import shiftsRouter from './routes/shifts';
import mpesaRouter from './routes/mpesa';
import sseRouter from './routes/sse';
import publicMenuRouter from './routes/publicMenu';
import forecastRouter from './routes/forecast';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// M-3 FIX: Trust the first proxy hop so rate-limiters read the real client IP
// Required when running behind nginx, Caddy, or any cloud load balancer in production
app.set('trust proxy', 1);

// ── Security & Parsing ────────────────────────────────────────────
// H-11 FIX: Replace plain helmet() with a CSP-hardened configuration.
// The JWT is stored in localStorage; a strict CSP is the primary browser-side XSS mitigation.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "https:"],
      connectSrc:     ["'self'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false, // Allow iframes for receipt printing
}));

// CORS: Fail fast in production if CORS_ORIGIN is not explicitly set
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error('[STARTUP] CORS_ORIGIN env variable is required in production. Set it to your frontend domain.');
}
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);

// Tenant-scoped routes
app.use('/api/tenants/:tenantId/users',       usersRouter);
app.use('/api/tenants/:tenantId/menu',        menuRouter);
app.use('/api/tenants/:tenantId/rooms',       roomsRouter);
app.use('/api/tenants/:tenantId/orders',      ordersRouter);
app.use('/api/tenants/:tenantId/reports',     reportsRouter);
app.use('/api/tenants/:tenantId/settings',    settingsRouter);
app.use('/api/tenants/:tenantId/inventory',   inventoryRouter);
app.use('/api/tenants/:tenantId/guests',      guestsRouter);
app.use('/api/tenants/:tenantId/kds',         kdsRouter);
app.use('/api/tenants/:tenantId/analytics',   analyticsRouter);
app.use('/api/tenants/:tenantId/messages',    messagesRouter);
app.use('/api/tenants/:tenantId/tables',      tablesRouter);
app.use('/api/tenants/:tenantId/procurement', procurementRouter);
app.use('/api/tenants/:tenantId/shifts',      shiftsRouter);
app.use('/api/tenants/:tenantId/mpesa',       mpesaRouter);
app.use('/api/tenants/:tenantId/sse',         sseRouter);
app.use('/api/tenants/:tenantId/forecast',    forecastRouter);

// ── Public routes (no auth) ───────────────────────────────────────
app.use('/api/menu', publicMenuRouter);

// ── Developer Test Overrides ──────────────────────────────────────
app.get('/api/test/weekly-report', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Forbidden: Disabled in production.' });
    return;
  }
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIp);
  if (!isLocal) {
    res.status(403).json({ error: 'Forbidden: Only accessible from localhost.' });
    return;
  }
  runWeeklyReportJob();
  res.json({ message: 'Weekly Report Job triggered manually. Check server terminal for the Ethereal URL.' });
});

// Manual trigger for nightly maintenance (dev only)
app.get('/api/test/maintenance', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Forbidden: Disabled in production.' });
    return;
  }
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIp);
  if (!isLocal) {
    res.status(403).json({ error: 'Forbidden: Only accessible from localhost.' });
    return;
  }
  runMaintenanceJobs();
  res.json({ message: 'Maintenance jobs triggered. Check server terminal for results.' });
});

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

export default app;
