import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2, Search, Receipt, CreditCard, Users, ChevronRight,
  CheckCircle2, XCircle, AlertCircle,
  X
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  emoji?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  createdAt: string;
  tableRef?: string | null;
  cashier: { name: string };
  guest?: { firstName: string; lastName: string } | null;
  room?: { number: string } | null;
  items: OrderItem[];
  payments: { method: string; amount: number }[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  COMPLETED: { label: 'Paid', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: CheckCircle2 },
  PENDING:   { label: 'Active', color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-border)', icon: AlertCircle },
  CANCELLED: { label: 'Voided', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
};

const Bills: React.FC = () => {
  const { user, tenant } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitMethod, setSplitMethod] = useState<'cash'|'card'|'mpesa'>('cash');
  const [payingParts, setPayingParts] = useState<number[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const res = await api.get(`/tenants/${user?.tenantId}/reports/orders?from=${weekAgo}T00:00:00&to=${today}T23:59:59`);
        setOrders(res.data);
        if (res.data.length > 0) setSelected(res.data[0]);
      } catch (err) {
        console.error('Failed to fetch bills', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.tenantId) fetchOrders();

  }, [user?.tenantId]);

  const filtered = orders.filter(o => {
    const matchSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.tableRef || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.guest ? `${o.guest.firstName} ${o.guest.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) : false);
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCharge = async () => {
    if (!selected || !user?.tenantId) return;
    try {
      await api.put(`/tenants/${user?.tenantId}/orders/${selected.id}/status`, { status: 'COMPLETED' });
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'COMPLETED' } : o));
      setSelected({ ...selected, status: 'COMPLETED' });
      showToast(`Order #${selected.orderNumber} settled successfully ✓`, 'success');
    } catch (err) {
      console.error('Failed to settle order', err);
      showToast('Transaction failed', 'error');
    }
  };

  const handleSplitBill = async () => {
    if (!selected || !user?.tenantId) return;
    const splitAmount = Number((selected.total / splitCount).toFixed(2));
    const paidSetIdx = payingParts.length ? payingParts : [0];
    try {
      for (const _idx of paidSetIdx) {
        await api.post(`/tenants/${user?.tenantId}/orders/${selected.id}/payments`, {
          amount: splitAmount,
          method: splitMethod
        });
      }
      showToast(`${paidSetIdx.length}/${splitCount} split payments authorized`, 'success');
      setShowSplitModal(false);
      setPayingParts([]);
      
      // Auto-refresh the orders
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const res = await api.get(`/tenants/${user?.tenantId}/reports/orders?from=${weekAgo}&to=${today}`);
      setOrders(res.data);
      if (res.data.find((o: Order) => o.id === selected.id)) {
         setSelected(res.data.find((o: Order) => o.id === selected.id));
      }
    } catch (err) {
      showToast('Split transaction failed', 'error');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent)" />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Settlement Records...</span>
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || statusConfig.PENDING;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.65rem',
        fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`
      }}>
        <cfg.icon size={10} />
        {cfg.label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', gap: '1.5rem', overflow: 'hidden', animation: 'fadeUp 0.4s ease-out' }}>

      {/* ── Column 1: Order List ── */}
      <div className="card" style={{ width: '420px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', alignItems: 'center', letterSpacing: '-0.02em' }}>
              <div style={{ background: 'var(--accent-soft)', padding: '0.4rem', borderRadius: '8px' }}><Receipt color="var(--accent)" size={20} /></div>
              Folios
            </h2>
            <div style={{ background: 'var(--accent)', color: 'white', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.75rem', borderRadius: '99px' }}>
              {filtered.length} Bills
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={16} strokeWidth={3} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" placeholder="Search receipt #, table, or guest..." className="form-input"
              style={{ paddingLeft: '2.75rem', borderRadius: '99px', backgroundColor: 'var(--bg-elevated)', border: 'none', boxShadow: 'var(--shadow-sm)' }}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: '0.3rem', borderRadius: '10px', width: 'fit-content', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            {[['ALL', 'All'], ['PENDING', 'Active'], ['COMPLETED', 'Paid'], ['CANCELLED', 'Voided']].map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)} style={{
                  padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', border: 'none',
                  background: statusFilter === val ? 'var(--bg-inverted)' : 'transparent',
                  color: statusFilter === val ? 'var(--text-inverted)' : 'var(--text-secondary)'
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Order List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'var(--bg-deep)' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Receipt size={32} />
              </div>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No Folios Match</p>
              <p style={{ fontSize: '0.85rem' }}>Adjust your exact search criteria.</p>
            </div>
          ) : (
            filtered.map(order => {
              const isSelected = selected?.id === order.id;
              return (
                <div key={order.id} onClick={() => setSelected(order)}
                  style={{
                    padding: '1.125rem', borderRadius: '16px', marginBottom: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-card)',
                    boxShadow: isSelected ? '0 4px 15px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: isSelected ? 'var(--accent)' : 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          {order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{order.tableRef ? `Table ${order.tableRef}` : order.orderType.replace('_', ' ')}</span>
                        {order.guest && <span style={{ opacity: 0.5 }}>•</span>}
                        {order.guest && <span>{order.guest.firstName} {order.guest.lastName}</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 900, fontSize: '1.1rem', color: isSelected ? 'var(--accent)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        <span style={{ fontSize: '0.75rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>{tenant?.currency}</span> {Number(order.total).toLocaleString()}
                      </p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Column 2: Order Detail ── */}
      {selected ? (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          
          {/* Detail Header */}
          <div style={{ padding: '1.75rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Receipt size={24} />
              </div>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: '1.75rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{selected.orderNumber}</h2>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {new Date(selected.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} at {new Date(selected.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div>
              <StatusBadge status={selected.status} />
            </div>
          </div>

          {/* Scrollable detail body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', background: 'var(--bg-deep)' }}>
            {/* Order meta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
              {[
                { label: 'Origin', value: selected.tableRef ? `Table ${selected.tableRef}` : selected.orderType.replace('_', ' '), icon: <ChevronRight size={16} color="var(--accent)" /> },
                { label: 'Agent', value: selected.cashier?.name || '—', icon: <Users size={16} color="var(--accent)" /> },
                { label: 'Client', value: selected.guest ? `${selected.guest.firstName} ${selected.guest.lastName}` : 'Walk-in', icon: <Users size={16} color="var(--accent)" /> },
                { label: 'Settlement', value: selected.payments?.[0]?.method?.replace('_', ' ') || 'Pending Authorization', icon: <CreditCard size={16} color="var(--accent)" /> },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {icon} {label}
                  </p>
                  <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Order Items */}
            <div style={{ marginBottom: '2.5rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>Folio Items</p>
              
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {['', 'Resource', 'Amount'].map((h, idx) => (
                    <span key={h} style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', textAlign: idx === 2 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {selected.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', padding: '1.25rem 1.5rem', alignItems: 'center', gap: '1rem', borderBottom: i < selected.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', border: '1px solid var(--border)' }}>
                      {item.emoji || '🍽️'}
                    </div>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.name}</p>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.125rem' }}>x{item.quantity} units</p>
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tenant?.currency}</span> {Number(item.subtotal || item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: '16px', padding: '1.5rem 2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              {[
                { label: 'Subtotal', value: Number(selected.subtotal).toLocaleString() },
                { label: 'Taxation & Fees', value: Number(selected.taxAmount || 0).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  <span>{label}</span>
                  <span>{tenant?.currency} {value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Total</span>
                <span style={{ fontWeight: 900, color: 'var(--accent)', fontSize: '2rem', lineHeight: 1, letterSpacing: '-0.02em' }}>{tenant?.currency} {Number(selected.total).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Charge buttons */}
          {selected.status?.toUpperCase() === 'PENDING' && (
            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => { setSplitCount(2); setPayingParts([]); setShowSplitModal(true); }} style={{ fontSize: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                ÷ Split Bill
              </button>
              <button className="btn btn-primary" onClick={handleCharge} style={{ fontSize: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
                <CreditCard size={20} /> Record Full Payment
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Receipt size={40} color="var(--text-muted)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Folio Viewer</h2>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Select a transaction from the left panel to inspect details.</p>
        </div>
      )}

      {/* Split Bill Modal */}
      {showSplitModal && selected && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '32rem', padding: '2.5rem', animation: 'fadeUp 0.3s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ÷ Split Bill Authority
              </h3>
              <button type="button" onClick={() => setShowSplitModal(false)} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ background: 'var(--bg-deep)', borderRadius: '16px', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross Total</span>
              <strong style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{tenant?.currency} {Number(selected.total).toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>Equitable Split Quantity</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => setSplitCount(n)} style={{
                      flex: 1, padding: '0.875rem', borderRadius: '12px', transition: 'all 0.2s',
                      border: `1px solid ${splitCount === n ? 'var(--accent)' : 'var(--border)'}`,
                      background: splitCount === n ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: splitCount === n ? 'var(--text-inverted)' : 'var(--text-secondary)',
                      fontWeight: 800, cursor: 'pointer', fontSize: '1rem', boxShadow: splitCount === n ? '0 4px 10px rgba(0,0,0,0.1)' : 'none'
                    }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--accent-soft)', borderRadius: '16px', border: '1px solid var(--accent-border)', padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: '0.25rem' }}>Per Entity Burden</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {tenant?.currency} {(selected.total / splitCount).toFixed(2)}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>Identify Entities Settling Now</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {Array.from({ length: splitCount }, (_, i) => (
                    <button key={i} onClick={() => setPayingParts(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      style={{
                        padding: '0.875rem', borderRadius: '12px', transition: 'all 0.2s',
                        border: `1px solid ${payingParts.includes(i) ? 'var(--text-primary)' : 'var(--border)'}`,
                        background: payingParts.includes(i) ? 'var(--bg-inverted)' : 'var(--bg-elevated)',
                        color: payingParts.includes(i) ? 'var(--text-inverted)' : 'var(--text-secondary)',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                      }}>
                      Entity {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>Tender Protocol</label>
                <select className="form-input" style={{ padding: '1rem', fontSize: '0.9rem' }} value={splitMethod} onChange={e => setSplitMethod(e.target.value as any)}>
                  <option value="cash">Hard Currency (Cash)</option>
                  <option value="card">Terminal (Card)</option>
                  <option value="mpesa">Mobile (M-Pesa)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSplitModal(false)}>Discard Split</button>
              <button className="btn btn-primary" style={{ flex: 1.5 }} onClick={handleSplitBill} disabled={payingParts.length === 0}>
                Authorize {payingParts.length || ''} Payment{payingParts.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Bills;
