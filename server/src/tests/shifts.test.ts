import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let cashierId: string;
let shiftId: string;

beforeAll(async () => {
  const models = [
    prisma.payment, prisma.orderItem, prisma.roomCharge, prisma.loyaltyTransaction,
    prisma.stockTransaction, prisma.purchaseOrderItem, prisma.message, prisma.userChannelRead,
    prisma.booking, prisma.order, prisma.purchaseOrder, prisma.menuItemIngredient,
    prisma.menuItem, prisma.category, prisma.inventoryItem, prisma.supplier,
    prisma.guest, prisma.shift, prisma.user, prisma.table, prisma.room, prisma.tenant
  ];
  for (const model of models) {
    await (model as any).deleteMany();
  }

  const tenant = await prisma.tenant.create({ data: { name: 'Shift Tenant', slug: 'shift-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Cashier', email: 'cashier@shifts.com', role: 'cashier' } });
  cashierId = user.id;
  const jti = 'test-jti-' + Date.now();
  await prisma.session.create({ data: { token: jti, userId: user.id, tenantId, expiresAt: new Date(Date.now() + 86400000) } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role, jti }, process.env.JWT_SECRET || 'test-secret');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Cashier Shift & Float Isolation logic', () => {

  it('1. Successfully opens a fresh shift for a Cashier', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/shifts/open`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startingFloat: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.startingFloat).toBe(1500);
    expect(res.body.status).toBe('OPEN');
    shiftId = res.body.id;
  });

  it('2. Completely blocks attempting to open TWO shifts concurrently for the same Cashier', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/shifts/open`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startingFloat: 5000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already have an open shift');
  });

  it('3. GET /current conceals payment arrays to strictly enforce blind closing', async () => {
    const res = await request(app)
      .get(`/api/tenants/${tenantId}/shifts/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(shiftId);
    expect(res.body.startingFloat).toBe(1500);
    
    // Crucial: Ensure payments array is undefined or completely excluded to prevent UI float leaking
    expect(res.body.payments).toBeUndefined();
    expect(res.body.orders).toBeUndefined();
  });

  it('4. Safely closes the shift returning a variance discrepancy', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualCash: 1200 }); // Cashier miscounts, expects 1500 + 0

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');
    expect(res.body.expectedCash).toBe(1500); // System securely calculated 1500
    expect(res.body.actualCash).toBe(1200);   // Cashier declared 1200
  });

});
