import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const room = await prisma.room.findFirst({ where: { status: 'occupied' }});
  if (!room) return console.log('No occupied room found');
  console.log(`Checking out room ${room.id} (${room.number})`);
  
  try {
    const charges = await prisma.roomCharge.findMany({
      where: { roomId: room.id, isSettled: false }
    });
    console.log(`Found ${charges.length} unsettled charges`);
    
    await prisma.$transaction(async (tx) => {
      for (const charge of charges) {
        console.log(`Creating payment for charge ${charge.id}`);
        await tx.payment.create({
          data: {
            tenantId: room.tenantId,
            orderId: charge.orderId,
            method: 'card',
            amount: charge.amount,
            roomId: room.id,
          }
        });

        console.log(`Updating order ${charge.orderId}`);
        await tx.order.update({
          where: { id: charge.orderId },
          data: { status: 'completed' }
        });
      }

      console.log(`Marking charges settled`);
      await tx.roomCharge.updateMany({
        where: { tenantId: room.tenantId, roomId: room.id, isSettled: false },
        data: { isSettled: true, settledAt: new Date() }
      });

      console.log(`Updating room`);
      await tx.room.update({
        where: { id: room.id }, // OMITTED tenantId since id is unique
        data: {
          status: 'available',
          guestName: null,
          guestId: null,
          checkedInAt: null
        }
      });
    });
    console.log('Success');
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
