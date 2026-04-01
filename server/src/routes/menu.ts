import { Router, Response, Request } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/menu/categories
router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  const categories = await prisma.category.findMany({
    where: { tenantId: req.params.tenantId },
    include: { _count: { select: { menuItems: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(categories);
});

// POST /api/tenants/:tenantId/menu/categories
router.post(
  '/categories',
  authorize('hotel_admin', 'manager'),
  [body('name').notEmpty().trim(), body('icon').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const category = await prisma.category.create({
        data: {
          name: req.body.name,
          icon: req.body.icon,
          sortOrder: Number(req.body.sortOrder) || 0,
          tenantId: req.params.tenantId
        }
      });
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

// PATCH /api/tenants/:tenantId/menu/categories/:id
router.patch(
  '/categories/:id',
  authorize('hotel_admin', 'manager'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, id } = req.params;
      const data = { ...req.body };
      if (data.sortOrder !== undefined) data.sortOrder = Number(data.sortOrder);
      
      const category = await prisma.category.update({
        where: { id, tenantId },
        data
      });
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
);

// DELETE /api/tenants/:tenantId/menu/categories/:id
router.delete(
  '/categories/:id',
  authorize('hotel_admin', 'manager'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, id } = req.params;
      
      const count = await prisma.menuItem.count({ where: { categoryId: id } });
      if (count > 0) { res.status(400).json({ error: 'Cannot delete category with associated items' }); return; }

      await prisma.category.delete({ where: { id, tenantId } });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete category' });
    }
  }
);

// GET /api/tenants/:tenantId/menu/items
// F-18: Exclude archived items by default (pass ?includeArchived=true to see all)
router.get('/items', async (req: Request, res: Response): Promise<void> => {
  const { categoryId, includeArchived } = req.query;
  const items = await prisma.menuItem.findMany({
    where: { 
      tenantId: req.params.tenantId,
      ...(categoryId ? { categoryId: categoryId as string } : {}),
      ...(includeArchived !== 'true' ? { isArchived: false } : {}) // F-18
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  res.json(items);
});

// POST /api/tenants/:tenantId/menu/items
router.post(
  '/items',
  authorize('hotel_admin', 'manager'),
  [
    body('name').notEmpty().trim(),
    body('price').isNumeric(),
    body('categoryId').notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const item = await prisma.menuItem.create({
        data: {
          categoryId: req.body.categoryId,
          name: req.body.name,
          description: req.body.description,
          price: Number(req.body.price),
          tenantId: req.params.tenantId,
          ingredients: req.body.ingredients && req.body.ingredients.length > 0
            ? { create: req.body.ingredients.map((i: any) => ({ inventoryItemId: i.inventoryItemId, quantity: Number(i.quantity) })) }
            : undefined
        }
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create menu item' });
    }
  }
);

// PATCH /api/tenants/:tenantId/menu/items/:id
router.patch(
  '/items/:id',
  authorize('hotel_admin', 'manager'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, id } = req.params;
      const { name, description, price, emoji, categoryId, isAvailable, isArchived } = req.body;
      const data: Record<string, any> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (price !== undefined) data.price = Number(price);
      if (emoji !== undefined) data.emoji = emoji;
      if (categoryId !== undefined) data.categoryId = categoryId;
      if (isAvailable !== undefined) data.isAvailable = isAvailable;
      if (isArchived !== undefined) data.isArchived = isArchived; // F-18
      
      const item = await prisma.menuItem.update({
        where: { id, tenantId },
        data,
        include: { category: true }
      });
      res.json(item);
    } catch (error) {
      console.error('Menu item PATCH error:', error);
      res.status(500).json({ error: 'Failed to update menu item' });
    }
  }
);

// DELETE /api/tenants/:tenantId/menu/items/:id
// F-11 FIX: Check order history before deleting. Suggest archiving instead.
router.delete(
  '/items/:id',
  authorize('hotel_admin', 'manager'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, id } = req.params;

      // F-11: Check if any order has used this item
      const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } });
      if (orderCount > 0) {
        res.status(400).json({
          error: `This item appears in ${orderCount} historical order(s) and cannot be deleted. Archive it instead to hide it from the menu while preserving records.`,
          suggestion: 'archive'
        });
        return;
      }

      await prisma.menuItem.delete({ where: { id, tenantId } });
      res.status(204).end();
    } catch (error: any) {
      if (error?.code === 'P2003') {
        // Foreign key violation fallback
        res.status(400).json({ error: 'Item is referenced by existing orders. Archive it instead of deleting.' });
        return;
      }
      res.status(500).json({ error: 'Failed to delete menu item' });
    }
  }
);

export default router;
