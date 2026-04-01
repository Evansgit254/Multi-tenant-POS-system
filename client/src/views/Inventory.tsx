import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext';
import { 
  Plus, Search, Trash2, Edit2, Loader2, Package, 
  ArrowDownUp, Save, X, AlertTriangle, CheckCircle
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  costPrice: number;
}

const Inventory: React.FC = () => {
  const { user, tenant } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<{ isOpen: boolean, itemId: string | null }>({ isOpen: false, itemId: null });
  const [adjustData, setAdjustData] = useState({ type: 'IN', quantity: 0, notes: '' });

  const fetchData = async () => {
    try {
      const res = await api.get(`/tenants/${user?.tenantId}/inventory`);
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch inventory', err);
      showToast('Failed to fetch inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.tenantId) fetchData();
  }, [user?.tenantId]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdjustModalOpen.itemId) return;
    try {
      let finalQuantity = adjustData.quantity;
      if (adjustData.type === 'OUT' && finalQuantity > 0) finalQuantity = -finalQuantity;
      
      await api.post(`/tenants/${user?.tenantId}/inventory/${isAdjustModalOpen.itemId}/adjust`, {
         ...adjustData, quantity: finalQuantity
      });
      showToast('Stock adjusted successfully', 'success');
      setIsAdjustModalOpen({ isOpen: false, itemId: null });
      setAdjustData({ type: 'IN', quantity: 0, notes: '' });
      fetchData();
    } catch (err) {
      console.error('Adjustment failed', err);
      showToast('Failed to adjust stock', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.delete(`/tenants/${user?.tenantId}/inventory/${id}`);
      showToast('Inventory item deleted', 'success');
      fetchData();
    } catch (err) {
      console.error('Delete failed', err);
      showToast('Failed to delete item. It may be linked to a menu recipe.', 'error');
    }
  };

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemFormData, setItemFormData] = useState<Partial<InventoryItem>>({});

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (itemFormData.id) {
        await api.patch(`/tenants/${user?.tenantId}/inventory/${itemFormData.id}`, itemFormData);
        showToast('Inventory item updated', 'success');
      } else {
        await api.post(`/tenants/${user?.tenantId}/inventory`, itemFormData);
        showToast('Inventory item added', 'success');
      }
      setIsItemModalOpen(false);
      setItemFormData({});
      fetchData();
    } catch (err) {
      console.error('Save failed', err);
      showToast('Failed to save inventory item', 'error');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent)" />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Loading Stock Data...</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem', animation: 'fadeUp 0.4s ease-out' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', gap: '0.75rem', alignItems: 'center', letterSpacing: '-0.02em' }}>
            <div style={{ padding: '0.5rem', background: 'var(--accent-soft)', borderRadius: '12px' }}><Package className="text-accent" size={26}/></div>
            Inventory Command
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Real-time stock tracking and auditing.</p>
        </div>
        
        <div className="responsive-stack" style={{ alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} strokeWidth={3} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by name or SKU..." 
              className="form-input"
              style={{ paddingLeft: '3rem', borderRadius: '99px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', fontSize: '0.9rem', padding: '0.75rem 1rem 0.75rem 3rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary"
            style={{ borderRadius: '99px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
            onClick={() => { setItemFormData({}); setIsItemModalOpen(true); }}
          >
            <Plus size={18} /> New Item
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Details</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identifiers</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Stock Level</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Unit Cost</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Health</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => {
                const isLowStock = item.currentStock <= item.lowStockThreshold;
                return (
                  <tr key={item.id} style={{ borderBottom: index === filteredItems.length - 1 ? 'none' : '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                    
                    <td style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '8px', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <Package size={18} />
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.name}</span>
                    </td>
                    
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em', border: '1px solid var(--border)' }}>
                        {item.sku || 'NO-SKU'}
                      </span>
                    </td>
                    
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: isLowStock ? '#ef4444' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{item.currentStock.toLocaleString()}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'lowercase' }}>{item.unit}</span>
                      </div>
                    </td>
                    
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {tenant?.currency} {Number(item.costPrice).toLocaleString()}
                    </td>
                    
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                      {isLowStock ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem', borderRadius: '99px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <AlertTriangle size={12}/> Low
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem', borderRadius: '99px', background: 'rgba(34,197,94,0.1)', color: '#10b981', border: '1px solid rgba(34,197,94,0.2)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <CheckCircle size={12}/> Optimal
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          aria-label={`Adjust Stock for ${item.name}`}
                          onClick={() => setIsAdjustModalOpen({ isOpen: true, itemId: item.id })}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', background: 'var(--accent-soft)', color: 'var(--accent)', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <ArrowDownUp size={14} /> Adjust
                        </button>
                        <button
                          aria-label={`Edit ${item.name}`}
                          onClick={() => { setItemFormData(item); setIsItemModalOpen(true); }}
                          style={{ width: '2.25rem', height: '2.25rem', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          aria-label={`Delete ${item.name}`}
                          onClick={() => handleDelete(item.id, item.name)}
                          style={{ width: '2.25rem', height: '2.25rem', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                 <tr>
                   <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                      <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>No inventory items located.</p>
                      <p style={{ fontSize: '0.85rem' }}>Adjust your exact search criteria.</p>
                   </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen.isOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <form onSubmit={handleAdjustSubmit} className="card" style={{ width: '100%', maxWidth: '28rem', padding: '2.5rem', animation: 'fadeUp 0.3s ease-out' }}>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.625rem', letterSpacing: '-0.01em' }}>
                  <div style={{ background: 'var(--accent-soft)', padding: '0.5rem', borderRadius: '10px' }}><ArrowDownUp size={20} color="var(--accent)"/></div>
                  Adjust Stock Level
                </h3>
                <button type="button" onClick={() => setIsAdjustModalOpen({ isOpen: false, itemId: null })} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Adjustment Directive</label>
                  <select 
                    value={adjustData.type}
                    onChange={e => setAdjustData({...adjustData, type: e.target.value})}
                    className="form-input"
                    style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 700 }}
                  >
                    <option value="IN">Receive Inventory (+)</option>
                    <option value="OUT">Deduct Inventory (-)</option>
                    <option value="ADJUSTMENT">Manual Override / Audit</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Quantity Delta</label>
                  <input 
                    type="number" required min={adjustData.type !== 'ADJUSTMENT' ? 1 : undefined}
                    value={adjustData.quantity || ''}
                    onChange={e => setAdjustData({...adjustData, quantity: Number(e.target.value)})}
                    className="form-input"
                    placeholder="0"
                    style={{ padding: '1rem', fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {adjustData.type === 'ADJUSTMENT' ? 'Provide negative values to decrease.' : `Units to ${adjustData.type === 'OUT' ? 'deduct from' : 'add to'} current stock.`}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Audit Notes (Optional)</label>
                  <input 
                    type="text" value={adjustData.notes} onChange={e => setAdjustData({...adjustData, notes: e.target.value})}
                    className="form-input" placeholder="Reason for adjustment..." style={{ padding: '0.875rem' }}
                  />
                </div>
             </div>

             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsAdjustModalOpen({ isOpen: false, itemId: null })} className="btn btn-secondary">Discard</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Save size={18} /> Confirm Change</button>
             </div>
          </form>
        </div>,
        document.body
      )}

      {/* Item Modal (Create/Edit) */}
      {isItemModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <form onSubmit={handleItemSubmit} className="card" style={{ width: '100%', maxWidth: '32rem', padding: '2.5rem', animation: 'fadeUp 0.3s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {itemFormData.id ? 'Modify Item Configuration' : 'Establish New Item'}
              </h3>
              <button type="button" onClick={() => setIsItemModalOpen(false)} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div className="responsive-grid" style={{ gap: '1.25rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Item Nomenclature *</label>
                <input required type="text" value={itemFormData.name || ''} onChange={e => setItemFormData({...itemFormData, name: e.target.value})} className="form-input" placeholder="e.g. Vintage Whiskey" style={{ padding: '0.875rem' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>SKU / Identifier</label>
                <input type="text" value={itemFormData.sku || ''} onChange={e => setItemFormData({...itemFormData, sku: e.target.value})} className="form-input" placeholder="WHK-01" style={{ padding: '0.875rem', fontFamily: 'monospace' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Measurement Unit *</label>
                <input required type="text" value={itemFormData.unit || ''} onChange={e => setItemFormData({...itemFormData, unit: e.target.value})} className="form-input" placeholder="bottles, kg..." style={{ padding: '0.875rem' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Initial Stock Level</label>
                <input type="number" min="0" value={itemFormData.currentStock ?? ''} onChange={e => setItemFormData({...itemFormData, currentStock: e.target.value ? Number(e.target.value) : 0})} className="form-input" placeholder="0" style={{ padding: '0.875rem', fontFamily: 'monospace', fontWeight: 700 }} />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Low Stock Threshold</label>
                <input type="number" min="0" value={itemFormData.lowStockThreshold ?? 5} onChange={e => setItemFormData({...itemFormData, lowStockThreshold: e.target.value ? Number(e.target.value) : 0})} className="form-input" placeholder="5" style={{ padding: '0.875rem', fontFamily: 'monospace', fontWeight: 700 }} />
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Acquisition Cost ({tenant?.currency})</label>
                <input type="number" min="0" step="0.01" value={itemFormData.costPrice ?? ''} onChange={e => setItemFormData({...itemFormData, costPrice: e.target.value ? Number(e.target.value) : 0})} className="form-input" placeholder="0.00" style={{ padding: '0.875rem', fontFamily: 'monospace', fontWeight: 700 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Discard Change</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={18} /> {itemFormData.id ? 'Adopt Configuration' : 'Commit New Item'}</button>
            </div>

          </form>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Inventory;
