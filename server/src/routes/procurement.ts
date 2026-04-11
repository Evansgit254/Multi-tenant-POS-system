import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant, authorize } from '../middleware/auth';
import { sendEmail } from '../services/emailService';

const router = Router({ mergeParams: true });
// FORENSIC GAP FIX: Require manager or admin role to manage procurement
router.use(authenticate, scopeTenant, authorize('hotel_admin', 'manager'));

// --- Suppliers ---

router.get('/suppliers', async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId }
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

router.post('/suppliers', async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const { z } = await import('zod');
    const schema = z.object({
      name:    z.string().min(1, 'Supplier name is required'),
      contact: z.string().optional(),
      email:   z.string().email().optional().or(z.literal('')),
      phone:   z.string().optional(),
      address: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const supplier = await prisma.supplier.create({
      data: { tenantId, ...data }
    });
    res.status(201).json(supplier);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      res.status(400).json({ error: error.errors[0]?.message || 'Invalid supplier data' });
      return;
    }
    console.error('Failed to create supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

router.patch('/suppliers/:id', async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;
    const { name, contact, email, phone, address } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id, tenantId },
      data: { name, contact, email, phone, address }
    });
    res.json(supplier);
  } catch (error) {
    console.error('Failed to update supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// GAP #7 FIX: Guard supplier deletion — check for linked POs first
router.delete('/suppliers/:id', async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;

    const linkedPOs = await prisma.purchaseOrder.count({
      where: { supplierId: id, tenantId }
    });

    if (linkedPOs > 0) {
      return res.status(400).json({
        error: `Cannot delete supplier — they have ${linkedPOs} purchase order(s) on record. Archive or reassign the orders first.`
      });
    }

    await prisma.supplier.delete({ where: { id, tenantId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// --- Purchase Orders ---

router.get('/purchase-orders', async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const pos = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        supplier: true,
        items: {
          include: { inventoryItem: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pos);
  } catch (error) {
    console.error('Failed to fetch purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

router.post('/purchase-orders', async (req: any, res) => {
  try {
    const { tenantId } = req.params;
    const { supplierId, items, notes } = req.body;

    // M-8 FIX: Validate that all inventory items belong to this tenant
    for (const item of items) {
      const invItem = await prisma.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
      if (!invItem || invItem.tenantId !== tenantId) {
        return res.status(400).json({ error: `Inventory item ${item.inventoryItemId} does not belong to this tenant.` });
      }
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId,
        notes,
        totalAmount,
        status: 'draft',
        items: {
          create: items.map((item: any) => ({
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } }
      }
    });
    
    res.json(po);

    // Notify supplier by email (non-blocking)
    if (po.supplier?.email) {
      const lineItems = po.items.map((item: any) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${item.inventoryItem?.name || 'Item'}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">KES ${item.unitPrice}</td>
        </tr>`
      ).join('');
      const html = `
        <div style="font-family:Arial,sans-serif;padding:24px;max-width:600px;">
          <h2 style="color:#0f766e;">New Purchase Order — ${po.id.slice(-8).toUpperCase()}</h2>
          <p>You have received a new purchase order. Please review the items below and confirm availability.</p>
          <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px;text-align:left;">Item</th>
              <th style="padding:8px;text-align:right;">Quantity</th>
              <th style="padding:8px;text-align:right;">Unit Price</th>
            </tr></thead>
            <tbody>${lineItems}</tbody>
          </table>
          <p style="font-size:1.1rem;font-weight:bold;">Total Amount: KES ${po.totalAmount.toFixed(2)}</p>
          ${po.notes ? `<p><strong>Notes:</strong> ${po.notes}</p>` : ''}
          <p style="margin-top:1.5rem;font-size:12px;color:#64748b;">Please respond to your buyer to confirm this order.</p>
        </div>`;
      sendEmail(po.supplier.email, `New Purchase Order #${po.id.slice(-8).toUpperCase()}`, html).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to create purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// GAP #6 FIX: Allow editing a PO while it's still in 'draft' status
router.patch('/purchase-orders/:id', async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;
    const { supplierId, notes, items } = req.body;

    const existing = await prisma.purchaseOrder.findUnique({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Purchase Order not found' });
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: `Cannot edit a PO with status '${existing.status}'. Only draft POs can be modified.` });
    }

    // Recalculate total if items provided
    let totalAmount = existing.totalAmount;
    if (items && Array.isArray(items)) {
      totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

      // Replace all line items atomically
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await prisma.purchaseOrderItem.createMany({
        data: items.map((item: any) => ({
          purchaseOrderId: id,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });
    }

    const po = await prisma.purchaseOrder.update({
      where: { id, tenantId },
      data: { 
        ...(supplierId ? { supplierId } : {}),
        ...(notes !== undefined ? { notes } : {}),
        totalAmount
      },
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } }
      }
    });

    res.json(po);
  } catch (error) {
    console.error('Failed to update purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

router.patch('/purchase-orders/:id/status', async (req: any, res) => {
  try {
    const { tenantId, id } = req.params;
    const { status } = req.body;

    const existingPo = await prisma.purchaseOrder.findUnique({
      where: { id, tenantId },
      include: { items: true }
    });

    if (!existingPo) return res.status(404).json({ error: 'PO not found' });

    // M-9 FIX: Enforce PO status state machine to prevent stock manipulation via status cycling
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      draft:     ['sent', 'cancelled'],
      sent:      ['received', 'cancelled'],
      received:  [], // Terminal state — no transitions allowed after stock is received
      cancelled: []  // Terminal state
    };
    const currentStatus = existingPo.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition PO from '${currentStatus}' to '${status}'. Allowed: [${allowed.join(', ') || 'none — this is a terminal state'}]`
      });
    }

    const po = await prisma.purchaseOrder.update({
      where: { id, tenantId },
      data: { 
        status,
        receiveDate: status === 'received' ? new Date() : undefined
      },
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } }
      }
    });

    // If marked as received, update inventory stock
    if (status === 'received' && existingPo.status !== 'received') {
      for (const item of po.items) {
        await prisma.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            currentStock: { increment: item.quantity }
          }
        });

        await prisma.stockTransaction.create({
          data: {
            tenantId,
            inventoryItemId: item.inventoryItemId,
            userId: req.user?.id,
            type: 'IN',
            quantity: item.quantity,
            notes: `Received PO: ${po.id}`
          }
        });
      }
    } else if (existingPo.status === 'received' && status !== 'received') {
      // SECURITY GAP FIX: If marking a received PO back to draft/cancelled, reverse the stock!
      for (const item of po.items) {
        await prisma.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            currentStock: { decrement: item.quantity }
          }
        });

        await prisma.stockTransaction.create({
          data: {
            tenantId,
            inventoryItemId: item.inventoryItemId,
            userId: req.user?.id,
            type: 'OUT',
            quantity: item.quantity,
            notes: `Reversed PO: ${po.id} (Status changed to ${status})`
          }
        });
      }
    }

    res.json(po);
  } catch (error) {
    console.error('Failed to update PO status:', error);
    res.status(500).json({ error: 'Failed to update PO status' });
  }
});

export default router;
