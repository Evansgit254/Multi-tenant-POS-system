import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let cashierId: string;
let menuItemId: string;
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

  const tenant = await prisma.tenant.create({ data: { name: 'Reports Tenant', slug: 'rep-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Admin', email: 'req@rep.com', role: 'hotel_admin' } });
  cashierId = user.id;
  const jti = 'test-jti-' + Date.now();
  await prisma.session.create({ data: { token: jti, userId: user.id, tenantId, expiresAt: new Date(Date.now() + 86400000) } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role, jti }, process.env.JWT_SECRET || 'test-secret');

  const shift = await prisma.shift.create({ data: { tenantId, cashierId, status: 'OPEN', startingFloat: 0 } });
  shiftId = shift.id;

  const category = await prisma.category.create({ data: { tenantId, name: 'Food' } });
  const menu = await prisma.menuItem.create({ data: { tenantId, categoryId: category.id, name: 'Steak', price: 1000 } });
  menuItemId = menu.id;

  // Create Order 1: Fully Paid and Completed (1000 KES + 160 KES tax = 1160 KES, Paid via Card)
  const order1 = await prisma.order.create({
    data: {
      tenantId, cashierId, shiftId, orderNumber: 'REP-1', orderType: 'dine_in', status: 'COMPLETED',
      subtotal: 1000, taxAmount: 160, total: 1160, discount: 0,
    }
  });
  await prisma.payment.create({ data: { tenantId, orderId: order1.id, shiftId, amount: 1160, method: 'card' } });

  // Create Order 2: Fully Paid but Voided/Cancelled (1160 KES, Paid via Cash)
  const order2 = await prisma.order.create({
    data: {
      tenantId, cashierId, shiftId, orderNumber: 'REP-2', orderType: 'dine_in', status: 'CANCELLED',
      subtotal: 1000, taxAmount: 160, total: 1160, discount: 0,
    }
  });
  // The payment remains in the DB physically, simulating a real-world edge case where a refund isn't fully purged yet
  await prisma.payment.create({ data: { tenantId, orderId: order2.id, shiftId, amount: 1160, method: 'cash' } });

  // Create Order 3: Completed with massive discount logic
  // Subtotal = 1000. 50% discount = 500. Fixed discount = 100. Total manual discounts = 600.
  // The 'discount' column stores the aggregation (600).
  const order3 = await prisma.order.create({
    data: {
      tenantId, cashierId, shiftId, orderNumber: 'REP-3', orderType: 'dine_in', status: 'COMPLETED',
      subtotal: 1000, taxAmount: 160, discount: 600, discountFixed: 100, discountPercent: 50, total: 560
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Reports & Analytics Logic Shield', () => {

  it('1. Dashboard Revenue ignores Voided Payments correctly', async () => {
    // Only order 1 is 'completed'. The 'cash' payment belongs to a 'cancelled' order.
    const res = await request(app)
      .get(`/api/tenants/${tenantId}/analytics/dashboard?range=today`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    
    // Revenue by method should ONLY include 'card' -> 1160.
    expect(res.body.revenueByMethod['card']).toBe(1160);
    expect(res.body.revenueByMethod['cash']).toBeUndefined(); // Or undefined/0 since it was voided!
    expect(res.body.totalRevenue).toBe(1160 + 560); // Order 1 (1160) + Order 3 (560)
  });

  it('2. Shift Summary correctly avoids double-counting discounts', async () => {
    const res = await request(app)
      .get(`/api/tenants/${tenantId}/reports/shift-summary?from=2023-01-01`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // The only completed discounted order is Order 3, which has discount: 600.
    // If the double-count bug was live, it would add discount(600) + discountFixed(100) + (1000 * 50%) = 1200.
    // It should now purely return 600.
    expect(res.body.totalDiscounts).toBe(600);
  });

});
