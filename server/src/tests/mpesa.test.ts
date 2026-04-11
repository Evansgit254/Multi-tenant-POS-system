import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let tenantId: string;
let cashierId: string;
let token: string;
let orderId: string;

describe('M-Pesa Backend Webhook Processing', () => {

  beforeAll(async () => {
    // Clean up any leftover state from previous test runs
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.session.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    const ts = Date.now();
    const tenant = await prisma.tenant.create({ data: { name: 'M-Pesa Webhook Tenant', slug: `mpesa-tenant-${ts}` } });
    tenantId = tenant.id;

    const user = await prisma.user.create({ data: { tenantId, name: 'Mpesa Cashier', email: `mpesa-${ts}@test.com`, role: 'cashier' } });
    cashierId = user.id;

    const jti = `mpesa-jti-${ts}`;
    await prisma.session.create({ data: { token: jti, userId: cashierId, tenantId, expiresAt: new Date(Date.now() + 864000) } });
    token = jwt.sign({ id: user.id, tenantId, role: user.role, jti }, process.env.JWT_SECRET || 'test-secret');


    // Create a pending order using the correct schema fields
    const order = await prisma.order.create({
      data: {
        tenantId,
        cashierId,                  // required FK in schema
        orderNumber: 'MPESA-001',   // webhook matches on this field (AccountReference)
        status: 'PENDING',
        total: 500,
        subtotal: 500
      }
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Refuses to authorize random webhook payloads without proper stkCallback structure', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/mpesa/webhook`)
      .send({ hello: 'world' });

    expect(res.status).toBe(200); // Daraja always receives 200 to prevent retries
    // No DB side effects should occur
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment).toBeNull();
  });

  it('Successfully processes a Safaricom Webhook, generating a Payment and marking Order COMPLETED', async () => {
    const darajaPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: '1234-5678-9012',
          CheckoutRequestID: 'ws_CO_123456',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount',              Value: 500 },
              { Name: 'MpesaReceiptNumber',  Value: 'SGS7891234' },
              { Name: 'PhoneNumber',         Value: 254700000000 },
              // Webhook route matches on AccountReference === order.orderNumber
              { Name: 'AccountReference',    Value: 'MPESA-001' }
            ]
          }
        }
      }
    };

    // Note: The actual webhook route /api/tenants/:tenantId/mpesa/webhook is public to allow Safaricom in.
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/mpesa/webhook`)
      .send(darajaPayload);

    expect(res.status).toBe(200);

    // Verify effects in DB
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('COMPLETED');

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment).toBeDefined();
    expect(payment?.method).toBe('mpesa');
    expect(payment?.reference).toBe('SGS7891234');
    expect(payment?.amount).toBe(500);
  });
});
