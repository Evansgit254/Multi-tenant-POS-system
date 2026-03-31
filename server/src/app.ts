import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

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
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ── Security & Parsing ────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);

// Tenant-scoped routes
app.use('/api/tenants/:tenantId/users',     usersRouter);
app.use('/api/tenants/:tenantId/menu',      menuRouter);
app.use('/api/tenants/:tenantId/rooms',     roomsRouter);
app.use('/api/tenants/:tenantId/orders',    ordersRouter);
app.use('/api/tenants/:tenantId/reports',   reportsRouter);
app.use('/api/tenants/:tenantId/settings',  settingsRouter);
app.use('/api/tenants/:tenantId/inventory', inventoryRouter);
app.use('/api/tenants/:tenantId/guests',    guestsRouter);
app.use('/api/tenants/:tenantId/kds',       kdsRouter);
app.use('/api/tenants/:tenantId/analytics', analyticsRouter);
app.use('/api/tenants/:tenantId/messages',  messagesRouter);
app.use('/api/tenants/:tenantId/tables',      tablesRouter);
app.use('/api/tenants/:tenantId/procurement', procurementRouter);
app.use('/api/tenants/:tenantId/shifts',      shiftsRouter);
app.use('/api/tenants/:tenantId/mpesa',       mpesaRouter);

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

export default app;
