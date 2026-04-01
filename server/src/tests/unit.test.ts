/**
 * Unit Tests: Auth Middleware & Business Logic
 * Tests pure functions and middleware behavior with mocked dependencies.
 * No database calls — all Prisma/external deps are mocked.
 */

import jwt from 'jsonwebtoken';

// ---------- Helper: slug generation (mirrored from auth.ts) ----------

const generateSlug = (hotelName: string): string =>
  hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------- Helper: Token sign/decode (mirrors auth.ts signToken) ----------

const signToken = (
  user: { id: string; tenantId: string | null; role: string },
  secret = 'test-secret'
) => jwt.sign({ id: user.id, tenantId: user.tenantId, role: user.role }, secret, { expiresIn: '8h' });

// ---------- Authorize Middleware (pure logic, no Prisma) ----------

const authorize = (...roles: string[]) =>
  (req: any, res: any, next: () => void): void => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };

// ---------- ScopeTenant Middleware (pure logic) ----------

const scopeTenant = (req: any, res: any, next: () => void): void => {
  const user = req.user;
  const { tenantId } = req.params;
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (user.role === 'super_admin') { next(); return; }
  if (String(user.tenantId) !== String(tenantId)) {
    res.status(403).json({ error: 'Access denied to this tenant' });
    return;
  }
  next();
};

// ---------- Order Calculation Helpers ----------

const calculateSubtotal = (items: { price: number; quantity: number }[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const applyDiscount = (subtotal: number, discountFixed = 0, discountPercent = 0): number => {
  const percentOff = (subtotal * discountPercent) / 100;
  const total = subtotal - percentOff - discountFixed;
  return Math.max(0, total); // Never negative
};

const calculateTax = (subtotal: number, taxRate: number): number =>
  parseFloat((subtotal * (taxRate / 100)).toFixed(2));

// ---------- Loyalty Points Calculation ----------

const calculateLoyaltyEarned = (orderTotal: number, pointsPerUnit = 10, unitValue = 100): number =>
  Math.floor(orderTotal / unitValue) * pointsPerUnit;

const applyLoyaltyRedemption = (subtotal: number, pointsToRedeem: number, pointValue = 0.5): number => {
  const discount = pointsToRedeem * pointValue;
  return Math.max(0, subtotal - discount);
};

// ---------- PO Total Calculation ----------

const calculatePoTotal = (items: { quantity: number; unitPrice: number }[]): number =>
  items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

// ==========================================================================
// Test Suites
// ==========================================================================

describe('🔐 Auth — Slug Generation', () => {
  it('converts hotel name to a URL-safe slug', () => {
    expect(generateSlug('The Grand Hotel')).toBe('the-grand-hotel');
    expect(generateSlug('Mumo\'s Place & Café!')).toBe('mumo-s-place-caf-');
    expect(generateSlug('SERVEPOINT 2025')).toBe('servepoint-2025');
  });

  it('collapses multiple consecutive special chars into one dash', () => {
    expect(generateSlug('A---B   C')).toBe('a-b-c');
  });
});

// --------------------------------------------------------------------------

describe('🔐 Auth — JWT Token Structure', () => {
  const payload = { id: 'usr-1', tenantId: 'ten-1', role: 'hotel_admin' };

  it('signs a token with the correct payload structure', () => {
    const token = signToken(payload);
    const decoded = jwt.verify(token, 'test-secret') as any;
    expect(decoded.id).toBe('usr-1');
    expect(decoded.tenantId).toBe('ten-1');
    expect(decoded.role).toBe('hotel_admin');
  });

  it('decoded token carries an expiry (exp) field', () => {
    const token = signToken(payload);
    const decoded = jwt.verify(token, 'test-secret') as any;
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a token signed with a different secret', () => {
    const token = signToken(payload, 'wrong-secret');
    expect(() => jwt.verify(token, 'test-secret')).toThrow();
  });
});

// --------------------------------------------------------------------------

describe('🛡️ Middleware — authorize()', () => {
  const makeResMock = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('calls next() when user has an allowed role', () => {
    const req = { user: { id: '1', role: 'hotel_admin' } };
    const res = makeResMock();
    const next = jest.fn();
    authorize('hotel_admin', 'manager')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when user has an insufficient role', () => {
    const req = { user: { id: '1', role: 'cashier' } };
    const res = makeResMock();
    const next = jest.fn();
    authorize('hotel_admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is undefined', () => {
    const req = { user: undefined };
    const res = makeResMock();
    const next = jest.fn();
    authorize('hotel_admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows multiple roles in a single guard', () => {
    const roles = ['hotel_admin', 'manager', 'cashier'];
    for (const role of roles) {
      const req = { user: { id: '1', role } };
      const res = makeResMock();
      const next = jest.fn();
      authorize(...roles)(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});

// --------------------------------------------------------------------------

describe('🏢 Middleware — scopeTenant()', () => {
  const makeResMock = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('allows access when tenantId matches the JWT payload', () => {
    const req = { user: { id: '1', tenantId: 'ten-A', role: 'cashier' }, params: { tenantId: 'ten-A' } };
    const res = makeResMock();
    const next = jest.fn();
    scopeTenant(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks access when tenantId does NOT match', () => {
    const req = { user: { id: '1', tenantId: 'ten-A', role: 'cashier' }, params: { tenantId: 'ten-B' } };
    const res = makeResMock();
    const next = jest.fn();
    scopeTenant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('super_admin bypasses tenant scoping', () => {
    const req = { user: { id: '1', tenantId: 'ten-X', role: 'super_admin' }, params: { tenantId: 'ten-Y' } };
    const res = makeResMock();
    const next = jest.fn();
    scopeTenant(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when user is not attached to the request', () => {
    const req = { user: undefined, params: { tenantId: 'ten-A' } };
    const res = makeResMock();
    const next = jest.fn();
    scopeTenant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------

describe('🧮 Order — Subtotal Calculation', () => {
  it('correctly sums multi-item order subtotals', () => {
    const items = [
      { price: 500, quantity: 2 },
      { price: 300, quantity: 1 },
      { price: 150, quantity: 3 }
    ];
    expect(calculateSubtotal(items)).toBe(1750); // 1000 + 300 + 450
  });

  it('handles a single item order', () => {
    expect(calculateSubtotal([{ price: 2500, quantity: 1 }])).toBe(2500);
  });

  it('returns 0 for an empty cart', () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

// --------------------------------------------------------------------------

describe('🧮 Order — Discount Application', () => {
  it('applies a fixed discount correctly', () => {
    expect(applyDiscount(1000, 100, 0)).toBe(900);
  });

  it('applies a percentage discount correctly', () => {
    expect(applyDiscount(1000, 0, 10)).toBe(900); // 10% off 1000
  });

  it('applies both fixed + percentage discounts', () => {
    expect(applyDiscount(1000, 50, 10)).toBe(850); // 10% = 100, then -50
  });

  it('never returns a negative total (floor at 0)', () => {
    expect(applyDiscount(100, 500, 0)).toBe(0);
  });

  it('returns zero when discount equals 100%', () => {
    expect(applyDiscount(1000, 0, 100)).toBe(0);
  });
});

// --------------------------------------------------------------------------

describe('🏦 Order — Tax Calculation', () => {
  it('calculates 16% VAT correctly', () => {
    expect(calculateTax(1000, 16)).toBe(160);
  });

  it('calculates 0% tax (tax-exempt) correctly', () => {
    expect(calculateTax(1000, 0)).toBe(0);
  });

  it('rounds fractional tax to 2 decimal places', () => {
    expect(calculateTax(333, 16)).toBe(53.28); // 333 * 0.16 = 53.28
  });
});

// --------------------------------------------------------------------------

describe('🌟 Loyalty Points — Earn & Redeem', () => {
  it('earns 10 points for every KES 100 spent', () => {
    expect(calculateLoyaltyEarned(500)).toBe(50);
    expect(calculateLoyaltyEarned(1500)).toBe(150);
    expect(calculateLoyaltyEarned(99)).toBe(0); // Below threshold
  });

  it('floors loyalty points — no partial points', () => {
    expect(calculateLoyaltyEarned(150)).toBe(10); // 1 unit * 10pts
  });

  it('redeems loyalty points as a discount (0.5 per point)', () => {
    const subtotal = 1000;
    expect(applyLoyaltyRedemption(subtotal, 100)).toBe(950); // 100 * 0.5 = 50 off
    expect(applyLoyaltyRedemption(subtotal, 2000)).toBe(0);  // Cap at 0, never negative
  });
});

// --------------------------------------------------------------------------

describe('📦 Procurement — PO Total Calculation', () => {
  it('calculates PO total from multiple line items', () => {
    const items = [
      { quantity: 100, unitPrice: 20 },
      { quantity: 50, unitPrice: 10 },
    ];
    expect(calculatePoTotal(items)).toBe(2500); // 2000 + 500
  });

  it('returns 0 for empty PO', () => {
    expect(calculatePoTotal([])).toBe(0);
  });

  it('handles float unit prices precisely', () => {
    expect(calculatePoTotal([{ quantity: 3, unitPrice: 99.99 }])).toBeCloseTo(299.97);
  });
});
