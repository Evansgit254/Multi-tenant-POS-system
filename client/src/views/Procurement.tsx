import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, Truck, Plus, CheckCircle2, Clock, XCircle, Send, RefreshCw, ArrowDown, Save, X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Supplier { id: string; name: string; contact?: string; email?: string; phone?: string; }
interface InventoryItem { id: string; name: string; unit: string; currentStock: number; }
interface POItem { inventoryItemId: string; quantity: number; unitPrice: number; inventoryItem?: InventoryItem; }
interface PurchaseOrder {
  id: string; supplierId: string; status: string; totalAmount: number;
  notes?: string; orderDate: string; receiveDate?: string;
  supplier: Supplier; items: POItem[];
}

const statusBadge: Record<string, { label: string; color: string; bg: string; icon: any; border: string }> = {
  draft:     { label: 'Draft',     color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', icon: Clock },
  sent:      { label: 'Outbound',  color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-border)', icon: Send },
  received:  { label: 'Received',  color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: CheckCircle2 },
  cancelled: { label: 'Voided', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
};

const Procurement: React.FC = () => {
  const { user, tenant } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'orders' | 'suppliers'>('orders');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPOModal, setShowPOModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', email: '', phone: '' });
  const [poForm, setPOForm] = useState({ supplierId: '', notes: '', items: [{ inventoryItemId: '', quantity: 1, unitPrice: 0 }] });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const tid = user?.tenantId;

  const fetchAll = async () => {
    try {
      const [sRes, poRes, invRes] = await Promise.all([
        api.get(`/tenants/${tid}/procurement/suppliers`),
        api.get(`/tenants/${tid}/procurement/purchase-orders`),
        api.get(`/tenants/${tid}/inventory`),
      ]);
      setSuppliers(sRes.data);
      setOrders(poRes.data);
      setInventory(invRes.data);
    } catch {
      showToast('Failed to load procurement data', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tid) fetchAll(); }, [tid]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) {
      showToast('Supplier name is required', 'error');
      return;
    }
    try {
      await api.post(`/tenants/${tid}/procurement/suppliers`, newSupplier);
      showToast('Supplier registry updated', 'success');
      setShowSupplierModal(false);
      setNewSupplier({ name: '', contact: '', email: '', phone: '' });
      fetchAll();
    } catch { showToast('Registry fail', 'error'); }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplierId) {
      showToast('Select a supplier', 'error');
      return;
    }
    const validItems = poForm.items.filter(i => i.inventoryItemId && i.quantity > 0);
    if (!validItems.length) { showToast('Add valid items', 'error'); return; }
    try {
      await api.post(`/tenants/${tid}/procurement/purchase-orders`, { ...poForm, items: validItems });
      showToast('PO Issued', 'success');
      setShowPOModal(false);
      setPOForm({ supplierId: '', notes: '', items: [{ inventoryItemId: '', quantity: 1, unitPrice: 0 }] });
      fetchAll();
    } catch { showToast('Failed dispatching PO', 'error'); }
  };

  const handleStatusChange = async (poId: string, newStatus: string) => {
    try {
      await api.patch(`/tenants/${tid}/procurement/purchase-orders/${poId}/status`, { status: newStatus });
      showToast(`Purchase order updated to ${newStatus}`, 'success');
      fetchAll();
    } catch { showToast('Execution failure', 'error'); }
  };

  const addPOLine = () => setPOForm(f => ({ ...f, items: [...f.items, { inventoryItemId: '', quantity: 1, unitPrice: 0 }] }));
  const updatePOLine = (idx: number, key: string, val: any) =>
    setPOForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [key]: val } : item) }));

  const summary = { total: orders.length, draft: 0, sent: 0, received: 0, cancelled: 0 };
  orders.forEach(o => { if (o.status in summary) (summary as any)[o.status]++; });

  const filteredOrders = orders.filter(po => {
    const matchesSearch = !searchTerm || po.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) || (po.notes && po.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchesSupplier = supplierFilter === 'all' || po.supplierId === supplierFilter;
    return matchesSearch && matchesStatus && matchesSupplier;
  });

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <RefreshCw className="animate-spin" size={32} color="var(--accent)" />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Supply Chain...</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem', animation: 'fadeUp 0.4s ease-out' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', gap: '0.75rem', alignItems: 'center', letterSpacing: '-0.02em' }}>
            <div style={{ padding: '0.5rem', background: 'var(--accent-soft)', borderRadius: '12px' }}><Truck className="text-accent" size={26}/></div>
            Procurement
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Purchase orders and external vendor logistics.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-secondary"
            style={{ borderRadius: '99px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
            onClick={() => setShowSupplierModal(true)}
          >
            <Plus size={18} /> Add Supplier
          </button>
          <button 
            className="btn btn-primary"
            style={{ borderRadius: '99px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
            onClick={() => setShowPOModal(true)}
          >
            <Plus size={18} /> Create PO
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        {(['draft', 'sent', 'received', 'cancelled'] as const).map(s => {
          const cfg = statusBadge[s];
          const Icon = cfg.icon;
          return (
            <div key={s} onClick={() => setTab('orders')} className="card" style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{cfg.label}</span>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color }}>
                  <Icon size={14} />
                </div>
              </div>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>{(summary as any)[s]}</span>
            </div>
          );
        })}
      </div>

      {/* Control Bar */}
      <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: '0.375rem', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {(['orders', 'suppliers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.625rem 1.75rem', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            background: tab === t ? 'var(--bg-inverted)' : 'transparent',
            color: tab === t ? 'var(--text-inverted)' : 'var(--text-secondary)',
          }}>
            {t === 'orders' ? '📦 Purchase Orders' : '🏭 Suppliers Directory'}
          </button>
        ))}
      </div>

      {/* View: Orders */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeUp 0.4s ease-out' }}>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'var(--bg-elevated)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <input type="text" placeholder="Search suppliers or notes..." className="form-input" style={{ width: '100%' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: '200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {Object.entries(statusBadge).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="form-input" style={{ width: '200px' }} value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
              <option value="all">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {filteredOrders.length === 0 && (
            <div className="card" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={36} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>No Purchase Orders</h3>
              <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Create an order to track your supply chain.</p>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {filteredOrders.map((po, i) => {
              const cfg = statusBadge[po.status] || statusBadge.draft;
              const Icon = cfg.icon;
              return (
                <div key={po.id} className="card hover-scale" style={{ 
                  padding: '1.5rem', 
                  animationDelay: `${(i % 10) * 0.05}s`, 
                  display: 'flex', 
                  flexDirection: 'column',
                  borderTop: `4px solid ${cfg.color}`, // Visual distinction based on status
                  background: po.status === 'received' ? 'rgba(16, 185, 129, 0.02)' : 'var(--bg-elevated)'
                }}>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Supplier</span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginTop: '0.125rem' }}>{po.supplier.name}</h4>
                    </div>
                    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: '99px', padding: '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Icon size={12} /> {cfg.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-deep)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    {po.items.map((item, idx) => (
                      <span key={idx} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.375rem 0.625rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{item.quantity} {item.inventoryItem?.unit}</span> x {item.inventoryItem?.name || 'Item'}
                      </span>
                    ))}
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px dashed var(--border)', paddingTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.125rem' }}>Estimated Total</p>
                      <p style={{ fontSize: '1.35rem', fontWeight: 900, color: po.status === 'received' ? '#10b981' : 'var(--accent)' }}><span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{tenant?.currency}</span> {po.totalAmount.toLocaleString()}</p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {po.status === 'draft' && (
                        <button className="btn btn-secondary" onClick={() => handleStatusChange(po.id, 'sent')} style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'var(--bg-deep)' }}>
                          <Send size={14} /> Send Order
                        </button>
                      )}
                      {po.status === 'sent' && (
                        <button className="btn btn-primary" onClick={() => handleStatusChange(po.id, 'received')} style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#10b981', borderColor: '#10b981', color: '#fff' }}>
                          <ArrowDown size={14} /> Mark Received
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View: Suppliers */}
      {tab === 'suppliers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', animation: 'fadeUp 0.4s ease-out' }}>
          {suppliers.length === 0 && (
            <div className="card" style={{ gridColumn: '1/-1', padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={36} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>No Suppliers Found</h3>
              <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Add your suppliers to start tracking orders.</p>
            </div>
          )}
          {suppliers.map(s => (
            <div key={s.id} className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                <Truck size={20} />
              </div>
              
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.01em' }}>{s.name}</h3>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {s.contact && <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)' }}>👤</span> {s.contact}</p>}
                {s.email && <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)' }}>✉️</span> {s.email}</p>}
                {s.phone && <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)' }}>📞</span> {s.phone}</p>}
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
                  {orders.filter(o => o.supplierId === s.id).length} Orders Issued
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <form onSubmit={handleCreateSupplier} className="card" style={{ width: '100%', maxWidth: '28rem', padding: '2.5rem', animation: 'fadeUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ background: 'var(--accent-soft)', padding: '0.5rem', borderRadius: '10px' }}><Truck size={20} color="var(--accent)"/></div>
                Add Supplier
              </h3>
              <button type="button" onClick={() => setShowSupplierModal(false)} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Supplier / Company Name *</label>
                <input required type="text" className="form-input" placeholder="ACME Corp" style={{ padding: '0.875rem' }}
                  value={newSupplier.name} onChange={e => setNewSupplier(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Representative / POC</label>
                <input type="text" className="form-input" placeholder="Jane Doe" style={{ padding: '0.875rem' }}
                  value={newSupplier.contact} onChange={e => setNewSupplier(s => ({ ...s, contact: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Email</label>
                  <input type="email" className="form-input" placeholder="jane@acme.com" style={{ padding: '0.875rem' }}
                    value={newSupplier.email} onChange={e => setNewSupplier(s => ({ ...s, email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Phone</label>
                  <input type="text" className="form-input" placeholder="+1..." style={{ padding: '0.875rem' }}
                    value={newSupplier.phone} onChange={e => setNewSupplier(s => ({ ...s, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setShowSupplierModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Discard</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={18} /> Register Details</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* PO Modal */}
      {showPOModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <form onSubmit={handleCreatePO} className="card" style={{ width: '100%', maxWidth: '42rem', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', animation: 'fadeUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ background: 'var(--accent-soft)', padding: '0.5rem', borderRadius: '10px' }}><Package size={20} color="var(--accent)"/></div>
                Create Purchase Order
              </h3>
              <button type="button" onClick={() => setShowPOModal(false)} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Select Supplier</label>
                <select required className="form-input" style={{ padding: '1rem', fontSize: '0.9rem' }} value={poForm.supplierId} onChange={e => setPOForm(f => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">-- Choose Assigned Vendor --</option>
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-deep)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', margin: 0 }}>Order Items</label>
                  <button type="button" onClick={addPOLine} style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Plus size={12}/> Add Line Row</button>
                </div>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {poForm.items.map((line, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                      <select required className="form-input" style={{ padding: '0.75rem', fontSize: '0.85rem' }} value={line.inventoryItemId} onChange={e => updatePOLine(idx, 'inventoryItemId', e.target.value)}>
                        <option value="">Select Item...</option>
                        {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <input required type="number" className="form-input" placeholder="Qty" min={1} style={{ padding: '0.75rem', fontSize: '0.85rem' }} value={line.quantity || ''} onChange={e => updatePOLine(idx, 'quantity', Number(e.target.value))} />
                      <input required type="number" className="form-input" placeholder="Price" min={0} style={{ padding: '0.75rem', fontSize: '0.85rem' }} value={line.unitPrice || ''} onChange={e => updatePOLine(idx, 'unitPrice', Number(e.target.value))} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Notes</label>
                <textarea className="form-input" rows={2} style={{ padding: '1rem', resize: 'none' }} value={poForm.notes} onChange={e => setPOForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ background: 'var(--bg-inverted)', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-inverted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Total Value</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent)', background: 'rgba(184, 134, 11, 0.1)', border: '1px solid var(--accent)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                  Total: {tenant?.currency} {poForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
              <button type="button" onClick={() => setShowPOModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Send size={18} /> Create Purchase Order
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Procurement;
