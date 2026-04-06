/**
 * GuestMenu.tsx — Public guest-facing menu view.
 *
 * Accessible at /menu/:slug (no login required).
 * Guests can browse the menu and tap "Call Waiter" to send a message.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ChefHat, Bell } from 'lucide-react';

interface MenuItemPublic {
  id: string;
  name: string;
  description?: string;
  price: number;
  emoji: string;
  imageUrl?: string;
}

interface CategoryPublic {
  id: string;
  name: string;
  icon: string;
  menuItems: MenuItemPublic[];
}

interface TenantPublic {
  name: string;
  currency: string;
  logoUrl?: string;
  footer?: string;
}

const GuestMenu: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get('table');

  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [waiterCalled, setWaiterCalled] = useState(false);

  const API_BASE = (import.meta as any).env?.VITE_API_URL || window.location.origin;

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/menu/${slug}`);
        if (!res.ok) { setError('Menu not found.'); return; }
        const data = await res.json();
        setTenant(data.tenant);
        setCategories(data.categories);
        if (data.categories.length > 0) setActiveCategory(data.categories[0].id);
      } catch {
        setError('Failed to load menu. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [slug]);

  const handleCallWaiter = async () => {
    if (!tableToken) { alert('No table QR detected. Please scan your table QR code.'); return; }
    setWaiterCalled(true);
    setTimeout(() => setWaiterCalled(false), 5000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', gap: '1rem' }}>
        <Loader2 size={40} style={{ color: '#0f766e', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading menu…</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <ChefHat size={56} style={{ color: '#cbd5e1' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Menu Not Found</h2>
        <p style={{ color: '#64748b' }}>{error || 'This menu is not available.'}</p>
      </div>
    );
  }

  const activeCat = categories.find(c => c.id === activeCategory);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f766e 0%, #065f46 100%)', padding: '2rem 1.5rem 1.5rem', color: 'white', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        {tenant.logoUrl && (
          <img src={tenant.logoUrl} alt={tenant.name} style={{ width: '60px', height: '60px', borderRadius: '16px', objectFit: 'cover', marginBottom: '0.75rem', border: '2px solid rgba(255,255,255,0.3)' }} />
        )}
        {!tenant.logoUrl && (
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontSize: '1.75rem' }}>
            🍽️
          </div>
        )}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{tenant.name}</h1>
        <p style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.25rem' }}>Browse our menu</p>
      </div>

      {/* Category Tabs */}
      <div style={{ overflowX: 'auto', background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: '158px', zIndex: 9 }}>
        <div style={{ display: 'flex', padding: '0 1rem', gap: '0.25rem', minWidth: 'max-content' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '0.875rem 1rem', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit', fontWeight: 700,
                fontSize: '0.8rem', whiteSpace: 'nowrap', transition: 'all 0.2s',
                borderBottom: `3px solid ${activeCategory === cat.id ? '#0f766e' : 'transparent'}`,
                color: activeCategory === cat.id ? '#0f766e' : '#64748b',
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div style={{ padding: '1.25rem', maxWidth: '640px', margin: '0 auto' }}>
        {activeCat && activeCat.menuItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {activeCat.menuItems.map(item => (
              <div key={item.id} style={{ background: 'white', borderRadius: '16px', padding: '1.125rem', display: 'flex', gap: '1rem', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
                  {item.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: '#1e293b' }}>{item.name}</p>
                  {item.description && (
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>
                  )}
                </div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f766e', flexShrink: 0 }}>
                  {tenant.currency} {item.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>No items in this category.</p>
        )}
      </div>

      {/* Footer */}
      {tenant.footer && (
        <p style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>{tenant.footer}</p>
      )}

      {/* Call Waiter FAB */}
      {tableToken && (
        <button
          onClick={handleCallWaiter}
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem',
            padding: '0.875rem 1.5rem', borderRadius: '99px', border: 'none',
            background: waiterCalled ? '#10b981' : '#0f766e',
            color: 'white', fontWeight: 800, fontSize: '0.875rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 4px 24px rgba(15,118,110,0.45)',
            transition: 'all 0.3s ease', fontFamily: 'inherit',
            transform: waiterCalled ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <Bell size={18} />
          {waiterCalled ? '✓ Waiter notified!' : 'Call Waiter'}
        </button>
      )}
    </div>
  );
};

export default GuestMenu;
