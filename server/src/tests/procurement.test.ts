import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let supplierId: string;
let inventoryItemId: string;
let purchaseOrderId: string;

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

  const tenant = await prisma.tenant.create({ data: { name: 'Supply Tenant', slug: 'supply-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Supply Admin', email: 'admin@procure.com', role: 'hotel_admin' } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role }, process.env.JWT_SECRET || 'test-secret');

  const sup = await prisma.supplier.create({ data: { tenantId, name: 'Global Goods' } });
  supplierId = sup.id;

  const inv = await prisma.inventoryItem.create({ data: { tenantId, name: 'Water Bottles', currentStock: 0 } });
  inventoryItemId = inv.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Procurement Automation Engine Pipeline', () => {

  it('1. Creates a Draft Purchase Order bound to our suppliers correctly', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/procurement/purchase-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId,
        items: [
          { inventoryItemId, quantity: 100, unitPrice: 20 }
        ],
        notes: 'Monthly restock'
      });

    expect(res.status).toBe(200);
    purchaseOrderId = res.body.id;
    expect(res.body.status).toBe('draft');
    expect(res.body.totalAmount).toBe(2000); // 100 * 20
  });

  it('2. Marks the Supply Order as RECEIVED and automatically inflates Inventory stock levels', async () => {
    const res = await request(app)
      .patch(`/api/tenants/${tenantId}/procurement/purchase-orders/${purchaseOrderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'received' });

    expect(res.status).toBe(200);

    // Deep check to ensure Inventory actually updated globally!
    const inventory = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }});
    expect(inventory?.currentStock).toBe(100);

    // Deep check to ensure the StockTransaction log mapped natively!
    const log = await prisma.stockTransaction.findFirst({ where: { inventoryItemId }});
    expect(log?.type).toBe('IN');
    expect(log?.quantity).toBe(100);
  });

});
