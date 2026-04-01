import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

let token: string;
let tenantId: string;
let roomId: string;
let guestId: string;

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

  const tenant = await prisma.tenant.create({ data: { name: 'Rooms Tenant', slug: 'rooms-tenant-' + Date.now() } });
  tenantId = tenant.id;

  const user = await prisma.user.create({ data: { tenantId, name: 'Receptionist', email: 'desk@rooms.com', role: 'hotel_admin' } });
  token = jwt.sign({ id: user.id, tenantId, role: user.role }, process.env.JWT_SECRET || 'test-secret');

  const room = await prisma.room.create({ data: { tenantId, number: '101', type: 'single', status: 'available', tariff: 5000 } });
  roomId = room.id;

  const guest = await prisma.guest.create({ data: { tenantId, firstName: 'Folio', lastName: 'Master' } });
  guestId = guest.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Rooms & Folio Integration Logic', () => {

  let bookingId: string;

  it('1. Successfully assigns an available room strictly recording the chronologies', async () => {
    const today = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    const res = await request(app)
      .post(`/api/tenants/${tenantId}/rooms/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        guestId,
        guestName: 'Folio Master',
        checkIn: today,
        checkOut: tomorrow,
        totalPrice: 5000
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
    bookingId = res.body.id;
  });

  it('2. Blocks identical double-bookings completely causing overlaps to throw an Exception', async () => {
    // Attempting to book room 101 again exactly today, while Folio Master sits in it
    const today = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    const res = await request(app)
      .post(`/api/tenants/${tenantId}/rooms/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        guestId,
        guestName: 'Another Guest',
        checkIn: today,
        checkOut: tomorrow,
        totalPrice: 5000
      });

    // Our double_booking guard handles 409 Conflict if it overlaps perfectly
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already booked');
  });

  it('3. Atomically checks-in the Folio dynamically and mutates the Room successfully', async () => {
    const res = await request(app)
      .post(`/api/tenants/${tenantId}/rooms/bookings/${bookingId}/check-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);

    const r = await prisma.room.findUnique({ where: { id: roomId }});
    expect(r?.status).toBe('occupied'); // The logic mathematically occupies the room!
  });

});
