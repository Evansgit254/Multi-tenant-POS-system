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
  token = jwt.sign({ id: user.id, tenantId, role: user.role }, process.env.JWT_SECRET || 'test-secret');
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

  it('3. Safely closes the shift returning a perfectly matched Float discrepancy state', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualCash: 1500 }); // Matches perfectly since 0 transactions occurred

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');
    expect(res.body.actualCash).toBe(res.body.expectedCash);
  });

});
