import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

let tenantId: string;
let userId: string;

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

  const tenant = await prisma.tenant.create({ data: { name: 'Auth Tenant', slug: 'auth-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
  const user = await prisma.user.create({
    data: {
      tenantId,
      name: 'Auth Admin',
      email: 'admin@auth.com',
      passwordHash: hashedPassword,
      role: 'hotel_admin'
    }
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Authentication Data Logic Guarding', () => {

  it('1. Successfully generates JWT upon correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@auth.com',
        password: 'SecurePassword123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('hotel_admin');
  });

  it('2. Rejects authorization completely if password hashing mismatches', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@auth.com',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid credentials');
  });

  it('3. Rejects login if email explicitly does not exist', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ghost@auth.com',
        password: 'SecurePassword123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid credentials');
  });

});
