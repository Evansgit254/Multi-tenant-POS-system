import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, requirePermission, PERMISSIONS } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Basic auth for all inventory routes - Need VIEW_STOCK to see anything
router.use(authenticate, scopeTenant, requirePermission(PERMISSIONS.VIEW_STOCK));

// All roles that can perform write operations
const WRITE_ROLES = ['admin', 'manager', 'hotel_admin', 'cashier'];
const ADMIN_ROLES = ['admin', 'manager', 'hotel_admin'];

// GET /api/tenants/:tenantId/inventory
// List all inventory items
router.get('/', async (req, res, next) => {
  try {
    const { tenantId } = req.params as Record<string, string>;
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/inventory
// Create a new inventory item
// Create a new inventory item - Need MANAGE_STOCK
router.post('/', requirePermission(PERMISSIONS.MANAGE_STOCK), async (req, res, next) => {
  try {
    const { tenantId } = req.params as Record<string, string>;
    const schema = z.object({
      name: z.string().min(1),
      sku: z.string().optional(),
      unit: z.string().default('units'),
      lowStockThreshold: z.number().default(10),
      costPrice: z.number().default(0),
      currentStock: z.number().default(0),
    });
    
    const data = schema.parse(req.body);
    const item = await prisma.inventoryItem.create({
      data: { ...data, tenantId }
    });
    
    // Log initial stock creation if stock > 0
    if (item.currentStock > 0) {
      await prisma.stockTransaction.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          type: 'IN',
          quantity: item.currentStock,
          userId: (req as any).user?.id,
          notes: 'Initial stock setup'
        }
      });
    }

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tenants/:tenantId/inventory/:id
// GAP #13 FIX: Allow updating currentStock directly (for fixing opening balances)
router.patch('/:id', requirePermission(PERMISSIONS.MANAGE_STOCK), async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const schema = z.object({
      name: z.string().optional(),
      sku: z.string().optional(),
      unit: z.string().optional(),
      lowStockThreshold: z.number().optional(),
      costPrice: z.number().optional(),
      currentStock: z.number().optional() // GAP #13: allow direct stock correction
    });
    
    const data = schema.parse(req.body);

    // If currentStock is explicitly passed, log an adjustment transaction
    const original = await prisma.inventoryItem.findUnique({ where: { id, tenantId } });
    if (!original) { (res as any).status(404).json({ error: 'Item not found' }); return; }

    const item = await prisma.inventoryItem.update({
      where: { id, tenantId },
      data
    });

    if (data.currentStock !== undefined && data.currentStock !== original.currentStock) {
      await prisma.stockTransaction.create({
        data: {
          tenantId,
          inventoryItemId: id,
          type: 'ADJUSTMENT',
          quantity: data.currentStock - original.currentStock,
          notes: `Manual stock correction (was ${original.currentStock}, now ${data.currentStock})`,
          userId: (req as any).user?.id
        }
      });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/inventory/:id/adjust
// Adjust stock (IN, OUT, ADJUSTMENT)
// Adjust stock (IN, OUT, ADJUSTMENT) - Need MANAGE_STOCK
router.post('/:id/adjust', requirePermission(PERMISSIONS.MANAGE_STOCK), async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const schema = z.object({
      type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
      quantity: z.number(), // + for IN/ADJUSTMENT, - for OUT/ADJUSTMENT
      notes: z.string().optional()
    });
    
    const { type, quantity, notes } = schema.parse(req.body);

    const transaction = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUniqueOrThrow({
        where: { id, tenantId }
      });

      // F-13 FIX: Prevent negative stock
      if (item.currentStock + quantity < 0) {
        throw new Error(`Adjustment would result in negative stock (current: ${item.currentStock}, adjustment: ${quantity})`);
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: { currentStock: item.currentStock + quantity }
      });
      await tx.stockTransaction.create({
        data: {
          tenantId,
          inventoryItemId: id,
          type,
          quantity,
          notes,
          userId: (req as any).user?.id
        }
      });
      
      return updatedItem;
    });

    res.json(transaction);
  } catch (error: any) {
    if (error?.message?.includes('negative stock')) {
      next({ status: 400, message: error.message });
    } else {
      next(error);
    }
  }
});

// GET /api/tenants/:tenantId/inventory/:id/transactions
// List transaction history
// List transaction history
router.get('/:id/transactions', async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    const transactions = await prisma.stockTransaction.findMany({
      where: { tenantId, inventoryItemId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } }
    });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tenants/:tenantId/inventory/:id
// Delete inventory item
// Delete inventory item - Need MANAGE_STOCK
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_STOCK), async (req, res, next) => {
  try {
    const { tenantId, id } = req.params as Record<string, string>;
    await prisma.inventoryItem.delete({
      where: { id, tenantId }
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// --- MENU ITEM INGREDIENTS ---

// GET /api/tenants/:tenantId/inventory/menu/:menuItemId/ingredients
// List ingredients for a menu item
router.get('/menu/:menuItemId/ingredients', async (req, res, next) => {
  try {
    const { menuItemId } = req.params as Record<string, string>;
    const ingredients = await prisma.menuItemIngredient.findMany({
      where: { menuItemId },
      include: { inventoryItem: true }
    });
    res.json(ingredients);
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/inventory/menu/:menuItemId/ingredients
// Add an ingredient mapping - Need MANAGE_STOCK
router.post('/menu/:menuItemId/ingredients', requirePermission(PERMISSIONS.MANAGE_STOCK), async (req, res, next) => {
  try {
    const { tenantId, menuItemId } = req.params as Record<string, string>;
    
    // SECURITY GAP FIX: Ensure the menuItem actually belongs to this tenant!
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId, tenantId }
    });
    if (!menuItem) {
      (res as any).status(404).json({ error: 'Menu item not found' }); return;
    }

    const schema = z.object({
      inventoryItemId: z.string().uuid(),
      quantity: z.number().positive()
    });
    
    const { inventoryItemId, quantity } = schema.parse(req.body);
    
    // Also ensure the inventory item belongs to this tenant
    const invItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId, tenantId }
    });
    if (!invItem) {
      (res as any).status(400).json({ error: 'Inventory item does not belong to your tenant' }); return;
    }

    const ingredient = await prisma.menuItemIngredient.create({
      data: { menuItemId, inventoryItemId, quantity }
    });

    res.status(201).json(ingredient);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tenants/:tenantId/inventory/ingredients/:ingredientId
// Remove an ingredient mapping - Need MANAGE_STOCK
router.delete('/ingredients/:ingredientId', requirePermission(PERMISSIONS.MANAGE_STOCK), async (req, res, next) => {
  try {
    const { tenantId, ingredientId } = req.params as Record<string, string>;
    
    // SECURITY GAP FIX: Ensure the ingredient mapping belongs to a menu item owned by this tenant
    const ingredient = await prisma.menuItemIngredient.findUnique({
      where: { id: ingredientId },
      include: { menuItem: { select: { tenantId: true } } }
    });
    
    if (!ingredient || ingredient.menuItem.tenantId !== tenantId) {
      (res as any).status(404).json({ error: 'Ingredient mapping not found or access denied' }); return;
    }

    await prisma.menuItemIngredient.delete({
      where: { id: ingredientId }
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
