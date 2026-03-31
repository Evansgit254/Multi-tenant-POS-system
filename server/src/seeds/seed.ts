import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ── Super Admin ──────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hotelpos.app' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@hotelpos.app',
      passwordHash: await bcrypt.hash('Admin@123', 12),
      role: 'super_admin',
    },
  });
  console.log('  ✓ Super admin:', superAdmin.email);

  // ── Demo Tenant ──────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'lakeside-hotel' },
    update: {},
    create: {
      name: 'Lakeside Grand Hotel',
      slug: 'lakeside-hotel',
      currency: 'KES',
      taxRate: 16,
      receiptFooter: 'Thank you for staying with us at Lakeside Grand Hotel!',
    },
  });
  console.log('  ✓ Tenant:', tenant.name);

  // ── Hotel Admin ──────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'manager@lakeside.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Jane Wanjiku',
      email: 'manager@lakeside.com',
      passwordHash: await bcrypt.hash('Manager@123', 12),
      role: 'hotel_admin',
    },
  });

  // ── Cashier ──────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'cashier@lakeside.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Brian Otieno',
      email: 'cashier@lakeside.com',
      passwordHash: await bcrypt.hash('Cashier@123', 12),
      role: 'cashier',
    },
  });
  console.log('  ✓ Staff users created');

  // ── Menu Categories ──────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Breakfast',    icon: '🌅', sortOrder: 1 },
    { name: 'Main Course',  icon: '🍽️', sortOrder: 2 },
    { name: 'Drinks',       icon: '🥤', sortOrder: 3 },
    { name: 'Desserts',     icon: '🍰', sortOrder: 4 },
    { name: 'Room Service', icon: '🛎️', sortOrder: 5 },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryDefs) {
    const existing = await prisma.category.findFirst({ where: { tenantId: tenant.id, name: cat.name } });
    const c = existing ?? await prisma.category.create({ data: { ...cat, tenantId: tenant.id } });
    categories[cat.name] = c.id;
  }
  console.log('  ✓ Categories seeded');

  // ── Menu Items ───────────────────────────────────────────────────
  type MenuItemDef = { category: string; name: string; price: number; emoji: string; description: string };
  const menuItems: MenuItemDef[] = [
    { category: 'Breakfast',    name: 'Full English Breakfast',    price: 850,  emoji: '🥚', description: 'Eggs, bacon, sausage, beans, toast' },
    { category: 'Breakfast',    name: 'Continental Breakfast',     price: 650,  emoji: '🥐', description: 'Croissant, jam, butter, OJ, coffee' },
    { category: 'Breakfast',    name: 'Tropical Fruit Platter',   price: 450,  emoji: '🍓', description: 'Seasonal fresh fruits' },
    { category: 'Main Course',  name: 'Grilled Tilapia',           price: 1200, emoji: '🐟', description: 'Served with ugali and vegetables' },
    { category: 'Main Course',  name: 'Nyama Choma (500g)',        price: 1500, emoji: '🥩', description: 'Roasted goat meat with kachumbari' },
    { category: 'Main Course',  name: 'Pilau Rice',                price: 750,  emoji: '🍛', description: 'Spiced rice with beef and salad' },
    { category: 'Main Course',  name: 'Chicken Biryani',           price: 1100, emoji: '🍗', description: 'Fragrant basmati with raita' },
    { category: 'Main Course',  name: 'Pasta Arrabiata',           price: 900,  emoji: '🍝', description: 'Penne in spicy tomato sauce' },
    { category: 'Drinks',       name: 'Fresh Juice',               price: 350,  emoji: '🍊', description: 'Orange, mango, or passion' },
    { category: 'Drinks',       name: 'Tusker Lager (500ml)',      price: 400,  emoji: '🍺', description: 'Ice cold Kenyan lager' },
    { category: 'Drinks',       name: 'Soft Drink (330ml)',        price: 150,  emoji: '🥤', description: 'Coke, Fanta, Sprite, or Water' },
    { category: 'Drinks',       name: 'Cappuccino',                price: 280,  emoji: '☕', description: 'Espresso with steamed milk foam' },
    { category: 'Drinks',       name: 'Premium Wine (glass)',      price: 850,  emoji: '🍷', description: 'House red or white' },
    { category: 'Desserts',     name: 'Chocolate Lava Cake',       price: 650,  emoji: '🎂', description: 'Warm cake with ice cream' },
    { category: 'Desserts',     name: 'Mango Sorbet',              price: 450,  emoji: '🍨', description: 'Refreshing mango sorbet' },
    { category: 'Room Service', name: 'Late Night Snack Platter',  price: 800,  emoji: '🧀', description: 'Cheese, crackers, cold cuts' },
    { category: 'Room Service', name: 'Morning Tea Set',           price: 500,  emoji: '🍵', description: 'Tea pot, milk, biscuits' },
  ];

  for (const item of menuItems) {
    const exists = await prisma.menuItem.findFirst({ where: { tenantId: tenant.id, name: item.name } });
    if (!exists) {
      await prisma.menuItem.create({
        data: { tenantId: tenant.id, categoryId: categories[item.category]!, name: item.name, description: item.description, price: item.price, emoji: item.emoji },
      });
    }
  }
  console.log('  ✓ Menu items seeded (17 items)');

  // ── Inventory Items & Ingredients ────────────────────────────────
  const inventoryDefs = [
    { name: 'Eggs', unit: 'pcs', currentStock: 200, lowStockThreshold: 50, costPrice: 15 },
    { name: 'Bacon', unit: 'kg', currentStock: 10, lowStockThreshold: 2, costPrice: 800 },
    { name: 'Tilapia Fish', unit: 'pcs', currentStock: 30, lowStockThreshold: 10, costPrice: 400 },
    { name: 'Tusker Bottle (500ml)', unit: 'bottles', currentStock: 100, lowStockThreshold: 24, costPrice: 200 },
  ];

  const inventoryItems: Record<string, string> = {};
  for (const inv of inventoryDefs) {
    const existing = await prisma.inventoryItem.findFirst({ where: { tenantId: tenant.id, name: inv.name } });
    const i = existing ?? await prisma.inventoryItem.create({ data: { ...inv, tenantId: tenant.id } });
    inventoryItems[inv.name] = i.id;

    // Log initial stock if newly created and stock > 0
    if (!existing && inv.currentStock > 0) {
      await prisma.stockTransaction.create({
        data: {
          tenantId: tenant.id,
          inventoryItemId: i.id,
          type: 'IN',
          quantity: inv.currentStock,
          notes: 'Initial seed stock',
        }
      });
    }
  }
  console.log('  ✓ Inventory items seeded');

  // Map ingredients to menu items
  const menuWithIngredients = [
    { menuName: 'Full English Breakfast', ingredients: [{ name: 'Eggs', qty: 2 }, { name: 'Bacon', qty: 0.15 }] },
    { menuName: 'Grilled Tilapia', ingredients: [{ name: 'Tilapia Fish', qty: 1 }] },
    { menuName: 'Tusker Lager (500ml)', ingredients: [{ name: 'Tusker Bottle (500ml)', qty: 1 }] },
  ];

  for (const m of menuWithIngredients) {
    const menuItem = await prisma.menuItem.findFirst({ where: { tenantId: tenant.id, name: m.menuName } });
    if (menuItem) {
      for (const ing of m.ingredients) {
        const invId = inventoryItems[ing.name];
        if (invId) {
          const existingIng = await prisma.menuItemIngredient.findFirst({
            where: { menuItemId: menuItem.id, inventoryItemId: invId }
          });
          if (!existingIng) {
            await prisma.menuItemIngredient.create({
              data: {
                menuItemId: menuItem.id,
                inventoryItemId: invId,
                quantity: ing.qty
              }
            });
          }
        }
      }
    }
  }
  console.log('  ✓ Menu item ingredients mapped');

  // ── Guests ───────────────────────────────────────────────────────
  const guestDefs = [
    { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+254700000001', loyaltyPoints: 150 },
    { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', phone: '+254700000002', loyaltyPoints: 45 },
  ];

  for (const g of guestDefs) {
    await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: g.email } }) 
      ?? await prisma.guest.create({ data: { ...g, tenantId: tenant.id } });
  }
  console.log('  ✓ Guests seeded');

  // ── Rooms ────────────────────────────────────────────────────────
  type RoomDef = { number: string; type: string; floor: number; status: 'available' | 'occupied' | 'maintenance'; guestName?: string };
  const roomDefs: RoomDef[] = [
    { number: '101', type: 'Standard', floor: 1, status: 'available' },
    { number: '102', type: 'Standard', floor: 1, status: 'occupied',    guestName: 'Mr. Kamau' },
    { number: '103', type: 'Standard', floor: 1, status: 'available' },
    { number: '201', type: 'Deluxe',   floor: 2, status: 'occupied',    guestName: 'Ms. Achieng' },
    { number: '202', type: 'Deluxe',   floor: 2, status: 'available' },
    { number: '203', type: 'Deluxe',   floor: 2, status: 'maintenance' },
    { number: '301', type: 'Suite',    floor: 3, status: 'occupied',    guestName: 'Dr. Mwangi' },
    { number: '302', type: 'Suite',    floor: 3, status: 'available' },
  ];

  for (const room of roomDefs) {
    await prisma.room.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number: room.number } },
      update: {},
      create: { ...room, tenantId: tenant.id },
    });
  }
  console.log('  ✓ Rooms seeded (8 rooms)');

  console.log('\n✅ Seed complete!\n');
  console.log('─── Demo Credentials ───────────────────────────────');
  console.log('  Super Admin  → admin@hotelpos.app    / Admin@123');
  console.log('  Hotel Admin  → manager@lakeside.com  / Manager@123');
  console.log('  Cashier      → cashier@lakeside.com  / Cashier@123');
  console.log('────────────────────────────────────────────────────');
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
