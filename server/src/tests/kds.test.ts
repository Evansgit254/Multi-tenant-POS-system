import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let orderId: string;
let orderItemId: string;

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

  const tenant = await prisma.tenant.create({ data: { name: 'KDS Tenant', slug: 'kds-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Chef', email: 'chef@kds.com', role: 'hotel_admin' } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role }, process.env.JWT_SECRET || 'test-secret');

  const shift = await prisma.shift.create({ data: { tenantId, status: 'OPEN', startingFloat: 0, cashierId: user.id } });

  const category = await prisma.category.create({ data: { tenantId, name: 'Hot Meals' } });
  const menu = await prisma.menuItem.create({ data: { tenantId, categoryId: category.id, name: 'Burger', price: 100 } });

  const order = await prisma.order.create({
    data: {
      tenantId,
      shiftId: shift.id,
      cashierId: user.id,
      orderNumber: 'KDS-001',
      status: 'pending',
      orderType: 'dine_in',
      subtotal: 100,
      taxAmount: 0,
      total: 100,
      items: {
        create: [
          { menuItemId: menu.id, name: 'Burger', quantity: 1, price: 100, subtotal: 100, kitchenStatus: 'PENDING' }
        ]
      }
    },
    include: { items: true }
  });
  
  orderId = order.id;
  orderItemId = order.items[0].id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('KDS State Machine Integrity logic', () => {

  it('1. Progresses an OrderItem ticket from PENDING to PREPARING successfully', async () => {
    const res = await request(app)
      .patch(`/api/tenants/${tenantId}/kds/tickets/${orderItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kitchenStatus: 'PREPARING' });

    expect(res.status).toBe(200);
    expect(res.body.kitchenStatus).toBe('PREPARING');
  });

  it('2. Prevents completely invalid enum states mutating the ticket', async () => {
    const res = await request(app)
      .patch(`/api/tenants/${tenantId}/kds/tickets/${orderItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kitchenStatus: 'A_FAKE_STATE' });

    expect(res.status).toBe(400); // Caught by Zod/validation bounds
  });

});
