import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReports() {
  const tenantId = '4e6886b1-1ca3-4ce3-bbb7-cf5aa89281a6'; // Delicacies tenantId
  
  // Let's see ALL orders for this tenant
  const allOrders = await prisma.order.findMany({
    where: { tenantId },
    select: { id: true, status: true, createdAt: true, total: true }
  });
  
  console.log(`\n=== ALL ORDERS FOR TENANT (Count: ${allOrders.length}) ===`);
  console.log(allOrders);

  // Replicate the shift-summary query exactly
  const fromStr = '2026-03-25';
  const toStr = '2026-04-01';
  
  const from = new Date(fromStr);
  
  let toDate = new Date(toStr);
  toDate.setHours(23, 59, 59, 999);

  console.log(`\n=== SHIFT SUMMARY FILTER ===`);
  console.log(`from: ${from.toISOString()}`);
  console.log(`toDate: ${toDate.toISOString()}`);

  const filteredOrders = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: from,
        lte: toDate,
      },
    },
    include: { payments: true }
  });

  console.log(`\n=== FILTERED ORDERS COUNT: ${filteredOrders.length} ===`);

  if (filteredOrders.length > 0) {
    console.log(`First filtered order:`, filteredOrders[0]);
  } else {
    // Let's figure out WHY it failed by checking the conditions one by one
    const tenantOrders = await prisma.order.count({ where: { tenantId } });
    console.log(`Tenant matches: ${tenantOrders}`);
    
    // Check just the GTE
    const gteOrders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: from } },
      select: { id: true, createdAt: true }
    });
    console.log(`GTE matches: ${gteOrders.length}`);
    
    // Check just the LTE
    const lteOrders = await prisma.order.findMany({
      where: { tenantId, createdAt: { lte: toDate } },
      select: { id: true, createdAt: true }
    });
    console.log(`LTE matches: ${lteOrders.length}`);
  }
}

checkReports()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
