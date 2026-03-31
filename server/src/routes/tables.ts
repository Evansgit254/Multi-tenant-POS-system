import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';

const router = Router({ mergeParams: true });

// F-1 FIX: All routes now require authentication and tenant scoping
router.use(authenticate, scopeTenant);

// Get all tables for a tenant
router.get('/', async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const tables = await prisma.table.findMany({
      where: { tenantId }
    });
    res.json(tables);
  } catch (error) {
    console.error('Failed to fetch tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Update table coordinates (for floor plan builder)
router.patch('/:id/coordinates', async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;
    const { x, y } = req.body;

    const table = await prisma.table.update({
      where: { id, tenantId },
      data: { x, y }
    });
    res.json(table);
  } catch (error) {
    console.error('Failed to update table coordinates:', error);
    res.status(500).json({ error: 'Failed to update table coordinates' });
  }
});

// Create a new table — requires hotel admin
router.post('/', authorize('hotel_admin', 'manager'), async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const { number, capacity, x, y } = req.body;

    const table = await prisma.table.create({
      data: {
        tenantId,
        number,
        capacity: capacity || 2,
        x: x || 0,
        y: y || 0
      }
    });
    res.json(table);
  } catch (error) {
    console.error('Failed to create table:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// Update a table
router.patch('/:id', authorize('hotel_admin', 'manager'), async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;
    const { number, capacity, status, isActive } = req.body;

    const table = await prisma.table.update({
      where: { id, tenantId },
      data: { number, capacity, status, isActive }
    });
    res.json(table);
  } catch (error) {
    console.error('Failed to update table:', error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// Delete a table
router.delete('/:id', authorize('hotel_admin', 'manager'), async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;
    await prisma.table.delete({
      where: { id, tenantId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete table:', error);
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

export default router;
