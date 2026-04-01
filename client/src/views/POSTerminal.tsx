import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, 
  BedSingle, Loader2, CheckCircle2, ShoppingBag, ChevronRight, 
  Percent, Tag, X, FileText, Sparkles, LayoutGrid, Clock
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  emoji: string;
  description: string; // Used for weights/subtitles like "170g"
}

const POSTerminal: React.FC = () => {
  const { user, tenant } = useAuth();
  const { items, addItem, updateQuantity, removeItem, clearCart, subtotal } = useCart();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  
  const [activeShift, setActiveShift] = useState<any>(null);
  const [startingFloat, setStartingFloat] = useState<string>('');
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // M-Pesa STK Push State
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  // M-Pesa tenant config
  const [mpesaStkConfigured, setMpesaStkConfigured] = useState(false);
  const [mpesaTillDisplay, setMpesaTillDisplay] = useState<string | null>(null);
  // Manual M-Pesa ref entry state
  const [showManualMpesaModal, setShowManualMpesaModal] = useState(false);
  const [mpesaRef, setMpesaRef] = useState('');
  
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountFixed, setDiscountFixed] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tableRef, setTableRef] = useState('');

  useEffect(() => {
    setRedeemPoints(false);
  }, [selectedGuestId]);

  const selectedGuest = guests.find(g => g.id === selectedGuestId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsRes, itemsRes, guestsRes, tablesRes, roomsRes, shiftRes, mpesaRes] = await Promise.all([
          api.get(`/tenants/${user?.tenantId}/menu/categories`),
          api.get(`/tenants/${user?.tenantId}/menu/items?available=true`),
          api.get(`/tenants/${user?.tenantId}/guests`),
          api.get(`/tenants/${user?.tenantId}/tables`),
          api.get(`/tenants/${user?.tenantId}/rooms`),
          api.get(`/tenants/${user?.tenantId}/shifts/current`),
          api.get(`/tenants/${user?.tenantId}/mpesa/status`),
        ]);
        setCategories(catsRes.data);
        setMenuItems(itemsRes.data);
        setGuests(guestsRes.data);
        setTables(tablesRes.data);
        setRooms(roomsRes.data);
        setActiveShift(shiftRes.data);
        setMpesaStkConfigured(!!mpesaRes.data?.isConfigured);
        setMpesaTillDisplay(mpesaRes.data?.tillDisplay || null);
      } catch (err) {
        console.error('Failed to fetch POS data', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.tenantId) fetchData();
  }, [user?.tenantId]);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCheckout = async (method: 'cash' | 'card' | 'mpesa' | 'room_charge') => {
    if (items.length === 0) return;
    
    // For M-Pesa, check if tenant has STK configured
    if (method === 'mpesa') {
      if (mpesaStkConfigured) {
        setShowMpesaModal(true);
      } else {
        setShowManualMpesaModal(true);
      }
      return;
    }
    
    setCheckoutStatus('processing');
    try {
      await api.post(`/tenants/${user?.tenantId}/orders`, {
        items: items.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
        orderType: method === 'room_charge' ? 'room_service' : 'dine_in',
        tableRef: tableRef || undefined,
        roomId: selectedRoomId || undefined,
        guestId: selectedGuestId,
        payment: { method },
        redeemPoints,
        discountFixed,
        discountPercent
      });
      setCheckoutStatus('success');
      setTimeout(() => {
        clearCart();
        setCheckoutStatus('idle');
        setIsCheckingOut(false);
        setDiscountFixed(0);
        setDiscountPercent(0);
        setTableRef('');
      }, 2000);
    } catch (err: any) {
      console.error('Checkout failed', err);
      setErrorMessage(err.response?.data?.error || 'Failed to place order');
      setCheckoutStatus('error');
    }
  };

  const taxRate = Number(tenant?.taxRate || 0);
  const tax = subtotal * (taxRate / 100);
  
  let currentDiscount = 0;
  if (selectedGuest && redeemPoints) currentDiscount += selectedGuest.loyaltyPoints;
  if (discountPercent > 0) currentDiscount += (subtotal * (discountPercent / 100));
  if (discountFixed > 0) currentDiscount += discountFixed;

  const total = Math.max(0, subtotal + tax - currentDiscount);

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin text-accent" size={32} />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Terminal...</span>
    </div>
  );

  const handleOpenShift = async () => {
    if (!startingFloat) return;
    setIsOpeningShift(true);
    try {
      const res = await api.post(`/tenants/${user?.tenantId}/shifts/open`, { startingFloat: Number(startingFloat) });
      setActiveShift(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to open shift');
    } finally {
      setIsOpeningShift(false);
    }
  };

  if (!activeShift) {
    return (
      <div style={{ display: 'flex', height: 'calc(100vh - 2rem)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ padding: '4rem 3rem', maxWidth: '480px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
           <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(184, 134, 11, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
              <Banknote size={40} />
           </div>
           <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.03em' }}>Register Closed</h2>
           <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1rem', marginBottom: '3.5rem', lineHeight: 1.6 }}>You must declare your starting float to begin accepting cash transactions on this station.</p>
           
           <div style={{ width: '100%', textAlign: 'left', marginBottom: '2.5rem' }}>
             <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.875rem', display: 'block', letterSpacing: '0.05em' }}>Starting Cash Drawer Float</label>
             <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--text-muted)', fontSize: '1.25rem' }}>{tenant?.currency}</span>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0.00"
                  style={{ paddingLeft: '4rem', height: '72px', borderRadius: '20px', fontWeight: 800, fontSize: '1.5rem' }} 
                  value={startingFloat} 
                  onChange={e => setStartingFloat(e.target.value)} 
                />
             </div>
           </div>

           <button 
             onClick={handleOpenShift}
             disabled={isOpeningShift || !startingFloat}
             className="btn btn-primary"
             style={{ width: '100%', height: '64px', borderRadius: '20px', fontSize: '1.1rem', fontWeight: 800, gap: '10px' }}
           >
             {isOpeningShift ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
             Open Register Shift
           </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 2rem)', gap: '2rem', overflow: 'hidden' }}>
      
      {/* ── Left: Menu Browser ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header & Categories */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                 <Sparkles size={14} /> POS TERMINAL
              </div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Checkout Hub</h1>
            </div>
            
            <div style={{ position: 'relative', width: '300px' }}>
              <Search style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="text" 
                placeholder="Search menu..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.875rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: '0.875rem 1.75rem', borderRadius: '16px', border: 'none', whiteSpace: 'nowrap',
                background: !selectedCategory ? 'var(--accent)' : 'white',
                color: !selectedCategory ? 'var(--text-inverted)' : 'var(--text-secondary)',
                fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', alignItems: 'center', gap: '0.625rem'
              }}
            >
              <LayoutGrid size={18} /> All Items
            </button>
            {categories.map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '0.875rem 1.75rem', borderRadius: '16px', border: 'none', whiteSpace: 'nowrap',
                    background: isActive ? 'var(--accent)' : 'white',
                    color: isActive ? 'var(--text-inverted)' : 'var(--text-secondary)',
                    fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex', alignItems: 'center', gap: '0.625rem'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span> {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem', alignContent: 'start' }}>
          {filteredItems.map((item, i) => (
            <div 
              key={item.id} 
              className="card" 
              onClick={() => addItem({ id: item.id, name: item.name, price: Number(item.price), emoji: item.emoji })}
              style={{ 
                padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', textAlign: 'center', borderRadius: '28px', 
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                animationDelay: `${(i % 12) * 0.05}s` 
              }}
            >
              <div style={{ 
                width: '6rem', height: '6rem', borderRadius: '24px', 
                background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', fontSize: '3rem', marginBottom: '1.25rem'
              }}>
                {item.emoji}
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>{item.name}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.75rem' }}>{item.description || 'Standard'}</p>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--accent)' }}>
                {tenant?.currency} {Number(item.price).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Ticket Panel (White / High-Contrast) ── */}
      <div style={{ 
        width: '420px', display: 'flex', flexDirection: 'column', borderRadius: '32px', 
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.05)'
      }}>
        
        {/* Ticket Header */}
        <div style={{ padding: '2rem', borderBottom: '1px solid var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={24} color="var(--accent)" /> Ticket
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {items.length > 0 && (
              <button 
                onClick={clearCart}
                style={{ background: '#fff1f2', color: '#f43f5e', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 800, padding: '8px 14px', borderRadius: '99px', background: 'var(--bg-deep)', color: 'var(--text-primary)' }}>
              {items.length} Items
            </span>
          </div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
              <ShoppingBag size={64} color="var(--text-muted)" />
              <p style={{ marginTop: '1.25rem', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-muted)' }}>Ready for orders</p>
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: '1.25rem', background: 'var(--bg-base)', padding: '1.15rem', borderRadius: '20px', border: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ fontSize: '1.75rem' }}>{item.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{item.name}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 900 }}>{tenant?.currency} {item.price.toLocaleString()}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-elevated)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <button onClick={() => updateQuantity(item.id, -1)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'var(--bg-deep)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={16} /></button>
                <span style={{ fontSize: '1rem', fontWeight: 900, minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout Section */}
        <div style={{ padding: '2.5rem', background: 'var(--bg-deep)', borderTop: '1px solid var(--bg-deep)' }}>
          
          {/* Summary */}
          <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              <span style={{ opacity: 0.7 }}>Subtotal</span>
              <span style={{ fontWeight: 800 }}>{tenant?.currency} {subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              <span style={{ opacity: 0.7 }}>Tax ({taxRate}%)</span>
              <span style={{ fontWeight: 800 }}>{tenant?.currency} {tax.toLocaleString()}</span>
            </div>
            {currentDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#10b981', fontWeight: 900 }}>
                <span>Loyalty/Discount</span>
                <span>-{tenant?.currency} {currentDiscount.toLocaleString()}</span>
              </div>
            )}
            
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '1rem 0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
               <div>
                 <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Amount</p>
                 <span style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>{tenant?.currency} {total.toLocaleString()}</span>
               </div>
               <button 
                  onClick={() => setShowDiscountModal(true)}
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                >
                  <Tag size={16} /> Discount
                </button>
            </div>
          </div>

          {!isCheckingOut ? (
            <button
               disabled={items.length === 0}
               onClick={() => setIsCheckingOut(true)}
               className="btn btn-primary"
               style={{ width: '100%', height: '72px', borderRadius: '20px', fontSize: '1.25rem', fontWeight: 800, boxShadow: '0 12px 24px var(--accent-glow)' }}
            >
               Order Now <ChevronRight size={24} style={{ marginLeft: '8px' }} />
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>Order Type</label>
                    <select className="form-input" value={tableRef} onChange={e => setTableRef(e.target.value)} style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                      <option value="">Takeaway</option>
                      {tables.map(t => <option key={t.id} value={t.number}>Table {t.number}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>Customer</label>
                    <select className="form-input" value={selectedGuestId || ''} onChange={e => setSelectedGuestId(e.target.value || null)} style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                      <option value="">Walk-in</option>
                      {guests.map(g => <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>)}
                    </select>
                  </div>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>Apply Room Charge To</label>
                 <select className="form-input" value={selectedRoomId || ''} onChange={e => setSelectedRoomId(e.target.value || null)} style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                   <option value="">Not Applicable / Select Room...</option>
                   {rooms.filter(r => r.status === 'occupied').map(r => (
                     <option key={r.id} value={r.id}>Room {r.number} ({r.guestName})</option>
                   ))}
                 </select>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem' }}>
                  <button onClick={() => handleCheckout('cash')} className="btn" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', height: '58px', borderRadius: '14px', gap: '8px' }}>
                    <Banknote size={20} /> <span style={{ fontWeight: 800 }}>Cash</span>
                  </button>
                  <button onClick={() => handleCheckout('card')} className="btn" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', height: '58px', borderRadius: '14px', gap: '8px' }}>
                    <CreditCard size={20} /> <span style={{ fontWeight: 800 }}>Card</span>
                  </button>
                  <button onClick={() => handleCheckout('mpesa')} className="btn" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', height: '58px', borderRadius: '14px', gap: '8px' }}>
                    <Smartphone size={20} /> <span style={{ fontWeight: 800 }}>M-Pesa</span>
                  </button>
                  <button onClick={() => handleCheckout('room_charge')} className="btn btn-primary" style={{ height: '58px', borderRadius: '14px', gap: '8px' }}>
                    <BedSingle size={20} /> <span style={{ fontWeight: 800 }}>Room</span>
                  </button>
               </div>
               
               <button onClick={() => setIsCheckingOut(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', padding: '0.5rem' }}>
                  Modify Order
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlays (Modal/Status) */}
      {checkoutStatus !== 'idle' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(16px)' }}>
           <div className="card" style={{ padding: '3.5rem', textAlign: 'center', maxWidth: '420px', width: '90%', borderRadius: '40px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              {checkoutStatus === 'processing' ? (
                <>
                  <Loader2 className="animate-spin text-accent" size={56} style={{ margin: '0 auto 2rem' }} />
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Finalizing Order</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontWeight: 600 }}>Kitchen is being notified...</p>
                </>
              ) : checkoutStatus === 'success' ? (
                <>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Order Success</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontWeight: 600 }}>Transaction completed successfully.</p>
                </>
              ) : (
                <>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fff1f2', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                    <X size={40} />
                  </div>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Checkout Failed</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontWeight: 600 }}>{errorMessage}</p>
                  <button onClick={() => setCheckoutStatus('idle')} className="btn btn-primary" style={{ width: '100%', height: '60px', marginTop: '2.5rem' }}>Try Again</button>
                </>
              )}
           </div>
        </div>
      )}

      {showDiscountModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(16px)' }}>
           <div className="card" style={{ width: '400px', padding: '2.5rem', borderRadius: '32px', background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
                 <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Apply Deduction</h3>
                 <button onClick={() => setShowDiscountModal(false)} style={{ background: 'var(--bg-deep)', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                 <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.875rem', display: 'block' }}>Fixed Amount</label>
                    <div style={{ position: 'relative' }}>
                       <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--text-muted)' }}>{tenant?.currency}</span>
                       <input type="number" className="form-input" style={{ paddingLeft: '3.5rem', height: '60px', borderRadius: '16px', fontWeight: 800 }} value={discountFixed || ''} onChange={e => { setDiscountFixed(Number(e.target.value)); setDiscountPercent(0); }} />
                    </div>
                 </div>
                 <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>— OR —</div>
                 <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.875rem', display: 'block' }}>Percentage</label>
                    <div style={{ position: 'relative' }}>
                       <span style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--text-muted)' }}>%</span>
                       <input type="number" className="form-input" style={{ height: '60px', borderRadius: '16px', fontWeight: 800 }} value={discountPercent || ''} onChange={e => { setDiscountPercent(Number(e.target.value)); setDiscountFixed(0); }} />
                    </div>
                 </div>
                 <button onClick={() => setShowDiscountModal(false)} className="btn btn-primary" style={{ width: '100%', height: '64px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: 800 }}>Apply Discount</button>
                 <button onClick={() => { setDiscountFixed(0); setDiscountPercent(0); setShowDiscountModal(false); }} style={{ background: 'none', border: 'none', color: '#f43f5e', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>Clear All</button>
              </div>
           </div>
        </div>
      )}

      {/* M-Pesa STK Push Modal */}
      {showMpesaModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' }}>
          <div className="card" style={{ width: '400px', padding: '2.5rem', borderRadius: '32px', background: 'var(--bg-elevated)', textAlign: 'center' }}>
            {mpesaStatus === 'idle' && (
              <>
                <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(0, 163, 68, 0.12)', color: '#00A344', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem' }}>📱</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>M-Pesa Payment</h3>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2rem' }}>Enter the customer's Safaricom number to send a payment prompt.</p>
                <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>PHONE NUMBER</label>
                  <input type="tel" className="form-input" placeholder="07XXXXXXXX" style={{ height: '56px', borderRadius: '16px', fontWeight: 800, fontSize: '1.2rem' }} value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => { setShowMpesaModal(false); setMpesaPhone(''); setMpesaStatus('idle'); }} className="btn" style={{ flex: 1, height: '52px', borderRadius: '14px', background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 2, height: '52px', borderRadius: '14px', background: '#00A344' }} disabled={!mpesaPhone}
                    onClick={async () => {
                      setMpesaStatus('waiting');
                      try {
                        const orderRes = await api.post(`/tenants/${user?.tenantId}/orders`, { items: items.map(i => ({ menuItemId: i.id, quantity: i.quantity })), orderType: 'dine_in', tableRef: tableRef || undefined, guestId: selectedGuestId, redeemPoints, discountFixed, discountPercent });
                        const orderId = orderRes.data.id;
                        setPendingOrderId(orderId);
                        await api.post(`/tenants/${user?.tenantId}/mpesa/stk-push`, { phone: mpesaPhone, amount: total, orderId });
                        let attempts = 0;
                        const poll = setInterval(async () => {
                          attempts++;
                          if (attempts > 20) { clearInterval(poll); setMpesaStatus('error'); return; }
                          try {
                            const check = await api.get(`/tenants/${user?.tenantId}/orders/${orderId}`);
                            if (check.data.status === 'completed') {
                              clearInterval(poll);
                              setMpesaStatus('success');
                              setTimeout(() => { clearCart(); setShowMpesaModal(false); setMpesaPhone(''); setMpesaStatus('idle'); setIsCheckingOut(false); setPendingOrderId(null); }, 2500);
                            }
                          } catch { /* continue polling */ }
                        }, 3000);
                      } catch { setMpesaStatus('error'); }
                    }}>
                    Send to Phone
                  </button>
                </div>
              </>
            )}
            {mpesaStatus === 'waiting' && (
              <>
                <Loader2 className="animate-spin" size={56} style={{ margin: '0 auto 2rem', color: '#00A344' }} />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Awaiting Confirmation</h3>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.75rem' }}>Prompt sent to <strong>{mpesaPhone}</strong>. Customer should enter their M-Pesa PIN...</p>
              </>
            )}
            {mpesaStatus === 'success' && (
              <>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}><CheckCircle2 size={40} /></div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Payment Confirmed!</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>M-Pesa payment received.</p>
              </>
            )}
            {mpesaStatus === 'error' && (
              <>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fff1f2', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}><X size={40} /></div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Payment Timed Out</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>The customer did not confirm. Order is saved as pending.</p>
                <button onClick={() => { setShowMpesaModal(false); setMpesaStatus('idle'); }} className="btn btn-primary" style={{ width: '100%', height: '56px', marginTop: '2rem' }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual M-Pesa Modal (for tenants without STK Push configured) */}
      {showManualMpesaModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' }}>
          <div className="card" style={{ width: '400px', padding: '2.5rem', borderRadius: '32px', background: 'var(--bg-elevated)', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(0, 163, 68, 0.12)', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>📱</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Manual M-Pesa</h3>

            {/* Till number display if set */}
            {mpesaTillDisplay && (
              <div style={{ background: 'rgba(0,163,68,0.08)', border: '1px solid #00A344', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#00A344', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Customer pays to till:</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.1em', color: '#00A344' }}>{mpesaTillDisplay}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Amount: <strong>{tenant?.currency} {total.toLocaleString()}</strong></p>
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Ask the customer to pay via their M-Pesa menu, then enter the confirmation code below.
            </p>

            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>M-PESA CONFIRMATION CODE</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. QJL12ABCDE"
                style={{ height: '56px', borderRadius: '16px', fontWeight: 900, fontSize: '1.3rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                value={mpesaRef}
                onChange={e => setMpesaRef(e.target.value.toUpperCase())}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => { setShowManualMpesaModal(false); setMpesaRef(''); }} className="btn" style={{ flex: 1, height: '52px', borderRadius: '14px', background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, height: '52px', borderRadius: '14px', background: '#00A344' }}
                disabled={mpesaRef.length < 6}
                onClick={async () => {
                  setCheckoutStatus('processing');
                  setShowManualMpesaModal(false);
                  try {
                    await api.post(`/tenants/${user?.tenantId}/orders`, {
                      items: items.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
                      orderType: tableRef ? 'dine_in' : 'takeaway',
                      tableRef: tableRef || undefined,
                      guestId: selectedGuestId,
                      payment: { method: 'mpesa' },
                      redeemPoints, discountFixed, discountPercent,
                      mpesaReference: mpesaRef
                    });
                    setCheckoutStatus('success');
                    setTimeout(() => { clearCart(); setCheckoutStatus('idle'); setIsCheckingOut(false); setMpesaRef(''); }, 2000);
                  } catch (err: any) {
                    setErrorMessage(err.response?.data?.error || 'Failed to record M-Pesa payment');
                    setCheckoutStatus('error');
                  }
                }}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default POSTerminal;
