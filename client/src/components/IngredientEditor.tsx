import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
}

interface Ingredient {
  id: string;
  inventoryItemId: string;
  quantity: number;
  inventoryItem?: InventoryItem;
}

interface IngredientEditorProps {
  menuItemId: string;
  menuItemName: string;
  onClose: () => void;
}

const IngredientEditor: React.FC<IngredientEditorProps> = ({ menuItemId, menuItemName, onClose }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedInvId, setSelectedInvId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');

  const fetchData = async () => {
    try {
      const [invRes, ingRes] = await Promise.all([
        api.get(`/tenants/${user?.tenantId}/inventory`),
        api.get(`/tenants/${user?.tenantId}/inventory/menu/${menuItemId}/ingredients`)
      ]);
      setInventory(invRes.data);
      setIngredients(ingRes.data);
    } catch (err) {
      console.error('Failed to fetch ingredient data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [menuItemId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvId || !quantity) return;
    
    try {
      await api.post(`/tenants/${user?.tenantId}/inventory/menu/${menuItemId}/ingredients`, {
        inventoryItemId: selectedInvId,
        quantity: Number(quantity)
      });
      showToast('Ingredient added successfully', 'success');
      setSelectedInvId('');
      setQuantity('');
      fetchData();
    } catch (err) {
      console.error('Failed to add ingredient', err);
      showToast('Failed to link ingredient', 'error');
    }
  };

  const handleDelete = async (ingredientId: string) => {
    try {
      await api.delete(`/tenants/${user?.tenantId}/inventory/ingredients/${ingredientId}`);
      showToast('Ingredient removed', 'success');
      fetchData();
    } catch (err) {
      console.error('Failed to delete ingredient', err);
      showToast('Failed to remove ingredient', 'error');
    }
  };

  const filteredInventory = inventory.filter(i => 
    !ingredients.some(ing => ing.inventoryItemId === i.id)
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', padding: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ background: 'var(--bg-elevated)', width: '100%', maxWidth: '42rem', padding: '2rem', borderRadius: '32px', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.1)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', animation: 'scaleIn 0.2s ease-out' }}>
        
        {/* Glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '16rem', height: '16rem', background: 'var(--bg-base)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 10 }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Manage Ingredients</h3>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>For: <span style={{ color: 'var(--accent)', fontWeight: 900 }}>{menuItemName}</span></p>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '12px', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }} className="hover:bg-slate-100">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 0', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} size={32} /></div>
        ) : (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', zIndex: 10 }}>
            
            {/* Current Ingredients List */}
            <div style={{ background: 'rgba(248, 249, 250, 0.5)', borderRadius: '16px', border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '16rem', overflowY: 'auto', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} className="custom-scrollbar">
              <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 0.5rem' }}>Current Ingredients</h4>
              {ingredients.length === 0 ? (
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0.5rem' }}>No ingredients linked. This item will not deduct stock.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ingredients.map(ing => (
                    <div key={ing.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }}>
                      <div>
                        <p style={{ fontWeight: 900, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{ing.inventoryItem?.name}</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.125rem' }}>Deducts: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent)' }}>{ing.quantity} {ing.inventoryItem?.unit}</span> per order</p>
                      </div>
                      <button 
                        onClick={() => handleDelete(ing.id)}
                        style={{ padding: '0.5rem', color: 'var(--text-muted)', background: 'transparent', borderRadius: '8px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                        className="hover:text-red-500 hover:bg-red-50"
                        title="Remove Ingredient"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Form */}
            <form onSubmit={handleAdd} style={{ background: 'var(--bg-base)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Select Item</label>
                <select 
                  className="form-input cursor-pointer"
                  value={selectedInvId}
                  onChange={e => setSelectedInvId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Inventory Item --</option>
                  {filteredInventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (In stock: {i.currentStock} {i.unit})</option>
                  ))}
                </select>
              </div>
              <div style={{ width: '8rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Qty</label>
                <input 
                  type="number" 
                  step="any"
                  min="0.01"
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontWeight: 800 }}
                  placeholder="e.g. 1.5"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value ? Number(e.target.value) : '')}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary"
                style={{ height: '3rem', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                disabled={!selectedInvId || !quantity}
              >
                <Plus size={18} /> Add
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default IngredientEditor;
