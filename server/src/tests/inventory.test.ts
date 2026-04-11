import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let inventoryItemId: string;

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

  const tenant = await prisma.tenant.create({ data: { name: 'Inv Tenant', slug: 'inv-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Admin', email: 'admin@inv.com', role: 'hotel_admin' } });
  const jti = 'test-jti-' + Date.now();
  await prisma.session.create({ data: { token: jti, userId: user.id, tenantId, expiresAt: new Date(Date.now() + 86400000) } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role, jti }, process.env.JWT_SECRET || 'test-secret');

  const item = await prisma.inventoryItem.create({
    data: {
      tenantId,
      name: 'Flour',
      currentStock: 10,
      lowStockThreshold: 5,
      costPrice: 50
    }
  });
  inventoryItemId = item.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Inventory Module Data Logic', () => {

  it('1. Successfully manually adjusts currentStock and logs StockTransaction', async () => {
    // Current stock is 10. Admin realized it's actually 20.
    const res = await request(app)
      .patch(`/api/tenants/${tenantId}/inventory/${inventoryItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentStock: 20
      });

    expect(res.status).toBe(200);
    expect(res.body.currentStock).toBe(20);

    // Verify a stock transaction was generated for the difference (+10)
    const tx = await prisma.stockTransaction.findFirst({
      where: { inventoryItemId, type: 'ADJUSTMENT' }
    });

    expect(tx).toBeDefined();
    expect(tx?.quantity).toBe(10);
  });

  it('2. Blocks negative inventory adjustments dropping below zero', async () => {
    // Current stock is 20. Admin tries to deduct 30
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/inventory/${inventoryItemId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'OUT',
        quantity: -30
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('negative stock');
  });

});
