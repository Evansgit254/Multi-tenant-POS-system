import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let categoryId: string;
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

  const tenant = await prisma.tenant.create({ data: { name: 'Menu Tenant', slug: 'menu-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Menu Admin', email: 'admin@menu.com', role: 'hotel_admin' } });
  const jti = 'test-jti-' + Date.now();
  await prisma.session.create({ data: { token: jti, userId: user.id, tenantId, expiresAt: new Date(Date.now() + 86400000) } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role, jti }, process.env.JWT_SECRET || 'test-secret');

  const category = await prisma.category.create({ data: { tenantId, name: 'Main Course' } });
  categoryId = category.id;

  const inv = await prisma.inventoryItem.create({ data: { tenantId, name: 'Beef Raw', currentStock: 50 } });
  inventoryItemId = inv.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Menu Matrix & Deep Dependency Bindings', () => {

  it('1. Successfully constructs deep-nested Menu Items linked correctly to RAW inventory stocks', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/menu/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        name: 'Wagyu Beef Steak',
        description: 'Prime cut',
        price: 3500,
        ingredients: [
          { inventoryItemId, quantity: 1 } // Demands 1 unit of Beef Raw per Wagyu
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Wagyu Beef Steak');
    
    // Explicit verification that Prisma dynamically tracked the dependency deep node loop correctly
    const storedItem = await prisma.menuItem.findUnique({
      where: { id: res.body.id },
      include: { ingredients: true }
    });

    expect(storedItem?.ingredients[0].inventoryItemId).toBe(inventoryItemId);
    expect(storedItem?.ingredients[0].quantity).toBe(1);
  });

  it('2. Blocks Menu Items mapped to missing categories violently', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/menu/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: 'non-existent-uuid-x999',
        name: 'Ghost Item',
        price: 500
      });

    expect(res.status).toBe(500); // 500 Server error handled by P2003 FK constraints
  });

});
