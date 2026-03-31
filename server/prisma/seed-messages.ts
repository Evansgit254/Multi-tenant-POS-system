import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMessages() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return console.log('No tenant found. Migration failed.');

  const adminUser = await prisma.user.findFirst({ where: { role: 'hotel_admin' } });
  const cashierUser = await prisma.user.findFirst({ where: { role: 'cashier' } });
  if (!adminUser || !cashierUser) return console.log('Users not found');

  const now = new Date();
  
  const demoMsgs = [
    // FOH Team (id: foh)
    { channel: 'foh', senderId: cashierUser.id, content: "Table 12 is asking for the bill.", timeOffset: 5 },
    { channel: 'foh', senderId: adminUser.id, content: "Got it, printing now.", timeOffset: 3 },
    { channel: 'foh', senderId: cashierUser.id, content: "Can someone check on Room 101? They need extra towels.", timeOffset: 15 },
    
    // Kitchen (id: kitchen)
    { channel: 'kitchen', senderId: cashierUser.id, content: "Two medium steaks for Table 7.", timeOffset: 2 },
    { channel: 'kitchen', senderId: adminUser.id, content: "86 the sea bass, we just ran out.", timeOffset: 45 },
    
    // Maria (id: maria)
    { channel: 'maria', senderId: cashierUser.id, content: "Can you approve the void on Order #284?", timeOffset: 12 },
    { channel: 'maria', senderId: adminUser.id, content: "Sure, just logged in to approve it.", timeOffset: 10 },
    
    // Daniel (id: daniel)
    { channel: 'daniel', senderId: adminUser.id, content: "I'll handle the large party at 6 PM.", timeOffset: 20 },
    { channel: 'daniel', senderId: cashierUser.id, content: "Perfect, I've assigned you to Tables 4, 5, and 6 combo.", timeOffset: 18 }
  ];

  console.log(`Clearing old demo messages...`);
  await prisma.message.deleteMany({
    where: { tenantId: tenant.id }
  });

  console.log(`Seeding ${demoMsgs.length} new messages...`);
  for (const msg of demoMsgs) {
    const d = new Date(now);
    d.setMinutes(d.getMinutes() - msg.timeOffset);
    
    await prisma.message.create({
      data: {
        id: Math.random().toString(36).substring(7),
        tenantId: tenant.id,
        channel: msg.channel,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: d
      }

    });
  }

  console.log('Done!');
}

seedMessages()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
