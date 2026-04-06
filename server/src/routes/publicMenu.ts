/**
 * Public Menu Route — /api/menu/:slug
 *
 * Unauthenticated endpoint that serves the menu for a tenant by their unique slug.
 * Used by the guest-facing web app at /menu/:slug.
 *
 * Rate limited to 60 req/min per IP to prevent scraping.
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';

const router = Router();

const publicMenuLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/menu/:slug
router.get('/:slug', publicMenuLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        currency: true,
        receiptFooter: true,
        logoUrl: true,
        isActive: true,
      }
    });

    if (!tenant || !tenant.isActive) {
      res.status(404).json({ error: 'Menu not found.' });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        menuItems: {
          where: { isAvailable: true, isArchived: false },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            emoji: true,
            imageUrl: true,
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    res.json({
      tenant: {
        name: tenant.name,
        currency: tenant.currency,
        logoUrl: tenant.logoUrl,
        footer: tenant.receiptFooter,
      },
      categories: categories.filter(c => c.menuItems.length > 0),
    });
  } catch (err) {
    console.error('[PUBLIC MENU] Error:', err);
    res.status(500).json({ error: 'Failed to load menu.' });
  }
});

export default router;
