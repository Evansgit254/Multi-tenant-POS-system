import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let cashierId: string;
let menuItemId: string;
let inventoryItemId: string;
let guestId: string;
let shiftId: string;

beforeAll(async () => {
  // Wipe test database state cleanly before we start
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

  // Create seed ecosystem
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Tenant',
      slug: 'test-tenant-' + Date.now(),
      loyaltyEarnRate: 100
    }
  });
  tenantId = tenant.id;

  const user = await prisma.user.create({
    data: {
      tenantId,
      name: 'Test Cashier',
      email: 'cashier@test.com',
      role: 'cashier',
      isActive: true
    }
  });
  cashierId = user.id;

  const shift = await prisma.shift.create({
    data: {
      tenantId,
      cashierId,
      status: 'OPEN',
      startingFloat: 1000
    }
  });
  shiftId = shift.id;

  token = jwt.sign({ id: user.id, tenantId, role: user.role }, process.env.JWT_SECRET || 'test-secret');

  const category = await prisma.category.create({
    data: { tenantId, name: 'Test Category' }
  });

  const inventory = await prisma.inventoryItem.create({
    data: {
      tenantId,
      name: 'Burger Bun',
      currentStock: 50,
      lowStockThreshold: 10,
      costPrice: 20
    }
  });
  inventoryItemId = inventory.id;

  const menu = await prisma.menuItem.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: 'Test Burger',
      price: 500,
      ingredients: {
        create: [{ inventoryItemId: inventory.id, quantity: 2 }]
      }
    }
  });
  menuItemId = menu.id;

  const guest = await prisma.guest.create({
    data: {
      tenantId,
      firstName: 'John',
      lastName: 'Doe',
      loyaltyPoints: 500
    }
  });
  guestId = guest.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Orders Data Logic Integration', () => {

  it('1. Successfully processes a regular order & deducts inventory correctly', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderType: 'dine_in',
        items: [{ menuItemId, quantity: 2 }] // 2 burgers * 2 buns = 4 buns deducted
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(1000 + (1000 * 0.16)); // 1160 (16% tax default)
    expect(res.body.status).toBe('pending');
    
    // Verify stock
    const inv = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }});
    expect(inv?.currentStock).toBe(46); // 50 - 4
  });

  it('2. FATAL FIX VERIFICATION: Blocks negative quantity injection', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderType: 'dine_in',
        items: [{ menuItemId, quantity: -10 }] // Malicious injection
      });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Invalid value');
    expect(res.body.errors[0].path).toBe('items[0].quantity');
  });

  it('3. Blocks operation if inventory is insufficient', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderType: 'takeaway',
        items: [{ menuItemId, quantity: 30 }] // 30 burgers * 2 buns = 60 required (only 46 left)
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Insufficient stock/);
  });

  it('4. Successfully redeems loyalty points into discounts', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderType: 'dine_in',
        guestId: guestId,
        redeemPoints: true, // Should use the 500 points the guest has
        items: [{ menuItemId, quantity: 1 }]
      });

    expect(res.status).toBe(201);
    // 500 KES + 80 KES tax = 580 total before discount
    // 500 Loyalty points = 500 KES discount
    // Total should be 80.
    expect(res.body.discount).toBe(500);
    expect(res.body.total).toBe(80);

    const guest = await prisma.guest.findUnique({ where: { id: guestId }});
    // Expected earned points for this transaction: Math.floor(80 / 100) = 0 newly earned points.
    expect(guest?.loyaltyPoints).toBe(0); // 500 - 500
  });

  it('5. FATAL FIX VERIFICATION: Blocks negative payment payload', async () => {
    // Generate an order to pay for
    const orderRes = await request(app)
      .post(`/api/tenants/${tenantId}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderType: 'dine_in',
        items: [{ menuItemId, quantity: 1 }] // 580
      });

    const orderId = orderRes.body.id;

    const payRes = await request(app)
      .post(`/api/tenants/${tenantId}/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        method: 'cash',
        amount: -500 // Malicious negative payment injection
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.errors[0].path).toBe('amount');
  });

  it('6. Blocks payment over-settlement (Overpayment Error)', async () => {
    const orderRes = await request(app)
      .post(`/api/tenants/${tenantId}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderType: 'dine_in',
        items: [{ menuItemId, quantity: 1 }] // Total is 580
      });

    const orderId = orderRes.body.id;

    const payRes = await request(app)
      .post(`/api/tenants/${tenantId}/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        method: 'card',
        amount: 5000 // Too much money
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.error).toContain('exceeds outstanding balance');
  });

});
