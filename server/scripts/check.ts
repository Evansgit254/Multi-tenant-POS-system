import prisma from '../src/lib/prisma';

async function main() {
  const shifts = await prisma.shift.findMany({ include: { payments: true } });
  console.log('SHIFTS:', JSON.stringify(shifts, null, 2));
  
  const orders = await prisma.order.findMany({ include: { payments: true } });
  console.log('ORDERS:', JSON.stringify(orders, null, 2));

  const tenants = await prisma.tenant.findMany();
  console.log('TENANTS:', JSON.stringify(tenants, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
