/**
 * Server-Sent Events (SSE) module for real-time POS notifications.
 *
 * Events emitted:
 *  - order:new    → when a new order is created
 *  - order:ready  → when order status changes to 'ready'
 *  - low_stock    → when an inventory item drops below its threshold
 *
 * Usage (client):
 *   const es = new EventSource(`/api/tenants/${tenantId}/sse?token=<JWT>`);
 *   es.addEventListener('order:ready', (e) => notify(JSON.parse(e.data)));
 */

import { Router, Request, Response } from 'express';
import { EventEmitter } from 'events';
import { authenticate, scopeTenant } from '../middleware/auth';

const router = Router({ mergeParams: true });

// In-memory per-tenant event bus (sufficient for single-node deployments)
// For multi-node: replace with Redis pub/sub
const tenantBus = new Map<string, EventEmitter>();

export const getTenantBus = (tenantId: string): EventEmitter => {
  if (!tenantBus.has(tenantId)) {
    const bus = new EventEmitter();
    bus.setMaxListeners(200); // Support up to 200 concurrent clients per tenant
    tenantBus.set(tenantId, bus);
  }
  return tenantBus.get(tenantId)!;
};

export const emitToTenant = (tenantId: string, event: string, data: object) => {
  const bus = getTenantBus(tenantId);
  bus.emit(event, JSON.stringify(data));
};

// GET /api/tenants/:tenantId/sse
router.get(
  '/',
  authenticate,
  scopeTenant,
  (req: Request, res: Response) => {
    const { tenantId } = req.params;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    res.flushHeaders();

    // Send a heartbeat comment every 25s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    const bus = getTenantBus(tenantId);

    const send = (event: string) => (data: string) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    };

    const onOrderNew    = send('order:new');
    const onOrderReady  = send('order:ready');
    const onLowStock    = send('low_stock');

    bus.on('order:new',   onOrderNew);
    bus.on('order:ready', onOrderReady);
    bus.on('low_stock',   onLowStock);

    req.on('close', () => {
      clearInterval(heartbeat);
      bus.off('order:new',   onOrderNew);
      bus.off('order:ready', onOrderReady);
      bus.off('low_stock',   onLowStock);
    });
  }
);

export default router;
