import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Bed, 
  ChefHat, 
  BarChart4, 
  Settings, 
  LogOut,
  Building2,
  Package,
  UtensilsCrossed,
  Users,
  MessageSquare,
  Receipt,
  LayoutGrid,
  Truck,
  Sparkles,
  ChevronRight,
  Banknote,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';


interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles: string[];
  badge?: number;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, tenant, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Shift Management State
  const [activeShift, setActiveShift] = useState<any>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Dynamically calculate expected cash from live payments
  const expectedCashLive = activeShift ? 
    (activeShift.startingFloat || 0) + (activeShift.payments?.filter((p: any) => p.method === 'cash').reduce((sum: number, p: any) => sum + p.amount, 0) || 0) 
    : 0;

  useEffect(() => {
    if (showCloseModal && activeShift) {
      setActualCash(expectedCashLive.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCloseModal]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchUnread = async () => {
      try {
        const res = await api.get(`/tenants/${user.tenantId}/messages/unread-count`);
        setUnreadCount(res.data.count || 0);
      } catch {}
    };

    const fetchShift = async () => {
      try {
        const res = await api.get(`/tenants/${user.tenantId}/shifts/current`);
        setActiveShift(res.data);
      } catch {}
    };

    fetchUnread();
    fetchShift();

    const interval = setInterval(fetchUnread, 30000);
    const shiftInterval = setInterval(fetchShift, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(shiftInterval);
    };
  }, [user?.tenantId]);

  const handleCloseShift = async () => {
    setIsClosing(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/shifts/${activeShift.id}/close`, {
        actualCash: Number(actualCash),
        notes: closeNotes
      });
      setActiveShift(null);
      setShowCloseModal(false);
      setActualCash('');
      setCloseNotes('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to close shift');
    } finally {
      setIsClosing(false);
    }
  };

  const mainItems: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin', 'hotel_admin', 'cashier'] },
    { to: '/pos', icon: ShoppingCart, label: 'Food & Drinks', roles: ['hotel_admin', 'cashier'] },
    { to: '/messages', icon: MessageSquare, label: 'Messages', roles: ['hotel_admin', 'cashier'], badge: unreadCount > 0 ? unreadCount : undefined },
    { to: '/bills', icon: Receipt, label: 'Bills', roles: ['hotel_admin', 'cashier'] },
    { to: '/settings', icon: Settings, label: 'Settings', roles: ['hotel_admin'] },
  ];

  const advancedItems: NavItem[] = [
    { to: '/rooms', icon: Bed, label: 'Rooms', roles: ['hotel_admin', 'cashier'] },
    { to: '/menu', icon: ChefHat, label: 'Menu Mgmt', roles: ['hotel_admin'] },
    { to: '/inventory', icon: Package, label: 'Inventory', roles: ['hotel_admin'] },
    { to: '/kds', icon: UtensilsCrossed, label: 'Kitchen (KDS)', roles: ['hotel_admin', 'cashier'] },
    { to: '/floor-plan', icon: LayoutGrid, label: 'Floor Plan', roles: ['hotel_admin', 'cashier'] },
    { to: '/guests', icon: Users, label: 'Guests', roles: ['hotel_admin', 'cashier'] },
    { to: '/procurement', icon: Truck, label: 'Procurement', roles: ['hotel_admin'] },
    { to: '/reports', icon: BarChart4, label: 'Reports & Finances', roles: ['hotel_admin'] },
  ];

  if (user?.role === 'super_admin') {
    mainItems.push({ to: '/super-admin', icon: Building2, label: 'Tenants', roles: ['super_admin'] });
  }

  const filterItems = (items: NavItem[]) =>
    items.filter(i => i.roles.includes(user?.role || ''));

  const filteredMain = filterItems(mainItems);
  const filteredAdvanced = filterItems(advancedItems);

  return (
    <>
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Logo */}
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '12px', 
            background: 'linear-gradient(135deg, #b8860b 0%, #8b6508 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(184,134,11,0.3)'
          }}>
            <Sparkles size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'white', margin: 0 }}>
              ServePoint
            </h1>
            <p style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.05em', marginTop: '1px' }}>
              by Mumo Syntax & Capital
            </p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button 
          className="mobile-only"
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {/* Main Menu */}
        {filteredMain.length > 0 && (
          <>
            <p className="sidebar-section-title">Main Menu</p>
            {filteredMain.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{ 
                    marginLeft: 'auto', background: '#b8860b', color: 'white', 
                    fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px' 
                  }}>{item.badge}</span>
                )}
              </NavLink>
            ))}
          </>
        )}

        {/* Advanced Ops */}
        {filteredAdvanced.length > 0 && (
          <>
            <p className="sidebar-section-title">Advanced Ops</p>
            {filteredAdvanced.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Profile Card Footer */}
      <div className="sidebar-footer">
        <div className="profile-card">
          <div style={{ 
            width: '44px', height: '44px', borderRadius: '50%', 
            background: 'var(--accent)', border: '2px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', fontWeight: 800, color: 'white'
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'User'}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'capitalize' }}>
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {activeShift && (
          <button
            className="sidebar-link"
            onClick={() => setShowCloseModal(true)}
            style={{ width: '100%', border: 'none', background: 'rgba(16, 185, 129, 0.1)', cursor: 'pointer', marginTop: '1rem', color: '#10b981' }}
          >
            <Banknote size={20} />
            <span style={{ fontWeight: 800 }}>Close Shift</span>
            <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981' }} />
          </button>
        )}
        
        <button
          className="sidebar-link"
          onClick={logout}
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', marginTop: '0.5rem' }}
        >
          <LogOut size={20} />
          <span>Logout</span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
        </button>
      </div>
    </aside>

    {showCloseModal && activeShift && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-elevated)', borderRadius: '28px', padding: '2.5rem', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Shift Reconciliation</h2>
            <button onClick={() => setShowCloseModal(false)} style={{ background: 'var(--bg-deep)', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20}/></button>
          </div>

          <div style={{ background: 'var(--bg-deep)', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>Shift Start</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{new Date(activeShift.startTime).toLocaleTimeString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>Starting Float</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tenant?.currency || 'KES'} {activeShift.startingFloat.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '1px dashed var(--border)', margin: '0.25rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>Expected Cash in Drawer</span>
              <span style={{ fontWeight: 800, color: '#10b981' }}>{tenant?.currency || 'KES'} {expectedCashLive.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Actual Cash Counted</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text-muted)' }}>{tenant?.currency || 'KES'}</span>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0.00"
                  style={{ paddingLeft: '3.5rem', height: '56px', borderRadius: '14px', fontWeight: 800, fontSize: '1.2rem', background: 'var(--bg-base)' }}
                  value={actualCash}
                  onChange={e => setActualCash(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Closing Notes / Discrepancies</label>
              <textarea 
                className="form-input" 
                placeholder="Explain any overages/shortages here..."
                style={{ height: '80px', borderRadius: '14px', resize: 'none', background: 'var(--bg-base)', padding: '1rem' }}
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
              />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ 
              width: '100%', height: '56px', borderRadius: '16px', fontSize: '1.05rem', fontWeight: 800, 
              background: (!actualCash || isClosing) ? 'var(--bg-deep)' : '#10b981', 
              color: (!actualCash || isClosing) ? 'var(--text-muted)' : 'white', 
              boxShadow: (!actualCash || isClosing) ? 'none' : '0 8px 16px rgba(16, 185, 129, 0.2)',
              cursor: (!actualCash || isClosing) ? 'not-allowed' : 'pointer'
            }}
            disabled={!actualCash || isClosing}
            onClick={handleCloseShift}
          >
            {isClosing ? 'Closing Shift...' : 'Confirm & Close Shift'}
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default Sidebar;
