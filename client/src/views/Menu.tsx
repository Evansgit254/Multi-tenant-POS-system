import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Loader2, 
  ChefHat, 
  LayoutGrid,
  Save,
  X,
  ListPlus,
  CheckCircle,
  XCircle
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import IngredientEditor from '../components/IngredientEditor';

interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  _count: { menuItems: number };
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  emoji: string;
  description: string;
  isAvailable: boolean;
  category: { id: string; name: string };
}

const Menu: React.FC = () => {
  const { user, tenant } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingIngredientsFor, setEditingIngredientsFor] = useState<{id: string, name: string} | null>(null);

  const fetchData = async () => {
    try {
      const [catsRes, itemsRes] = await Promise.all([
        api.get(`/tenants/${user?.tenantId}/menu/categories`),
        api.get(`/tenants/${user?.tenantId}/menu/items`),
      ]);
      setCategories(catsRes.data);
      setItems(itemsRes.data);
    } catch (err) {
      console.error('Failed to fetch menu data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.tenantId) fetchData();
  }, [user?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'items') {
        if (formData.id) {
          await api.patch(`/tenants/${user?.tenantId}/menu/items/${formData.id}`, formData);
          showToast('Item updated successfully', 'success');
        } else {
          await api.post(`/tenants/${user?.tenantId}/menu/items`, formData);
          showToast('Item created successfully', 'success');
        }
      } else if (activeTab === 'categories') {
        if (formData.id) {
          await api.patch(`/tenants/${user?.tenantId}/menu/categories/${formData.id}`, formData);
          showToast('Category updated successfully', 'success');
        } else {
          await api.post(`/tenants/${user?.tenantId}/menu/categories`, formData);
          showToast('Category created successfully', 'success');
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save', err);
      showToast('Failed to save changes. Please try again.', 'error');
    }
  };

  const openAdd = () => {
    setFormData(activeTab === 'items' ? { isAvailable: true, emoji: '🍽️' } : { sortOrder: 0, icon: '📌' });
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api.delete(`/tenants/${user?.tenantId}/menu/items/${id}`);
      showToast('Item deleted successfully', 'success');
      fetchData();
    } catch (err) {
      console.error('Delete failed', err);
      showToast('Failed to delete item', 'error');
    }
  };

  const handleDeleteCategory = async (id: string, itemsCount: number) => {
    if (itemsCount > 0) {
      showToast('Cannot delete a category that still has items associated with it.', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/tenants/${user?.tenantId}/menu/categories/${id}`);
      showToast('Category deleted successfully', 'success');
      fetchData();
    } catch (err) {
      console.error('Delete category failed', err);
      showToast('Failed to delete category', 'error');
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin text-accent" size={48} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease-out' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', '@media (min-width: 768px)': { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } } as any}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ChefHat className="text-accent" size={32}/> Menu Management
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>
            Manage your hotel's menu categories and food items.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: '0.25rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
          <button
            onClick={() => setActiveTab('items')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800, transition: 'all 0.2s', background: activeTab === 'items' ? 'var(--text-inverted)' : 'transparent', color: activeTab === 'items' ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: activeTab === 'items' ? 'var(--shadow-sm)' : 'none', border: activeTab === 'items' ? '1px solid var(--border)' : '1px solid transparent' }}
          >
            <ChefHat size={16} /> Menu Items
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800, transition: 'all 0.2s', background: activeTab === 'categories' ? 'var(--text-inverted)' : 'transparent', color: activeTab === 'categories' ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: activeTab === 'categories' ? 'var(--shadow-sm)' : 'none', border: activeTab === 'categories' ? '1px solid var(--border)' : '1px solid transparent' }}
          >
            <LayoutGrid size={16} /> Categories
          </button>
        </div>
      </div>

      {/* Search & Add Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', '@media (min-width: 640px)': { flexDirection: 'row' } } as any}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', borderRadius: '16px', padding: '0.875rem 1rem 0.875rem 2.75rem', outline: 'none', color: 'var(--text-primary)', transition: 'all 0.2s' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={openAdd}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', whiteSpace: 'nowrap', padding: '0.875rem 1.5rem', borderRadius: '16px', fontWeight: 800 }}
        >
          <Plus size={20} /> Add New {activeTab === 'items' ? 'Item' : 'Category'}
        </button>
      </div>

      {/* Content */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '24px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', minHeight: '400px' }}>
        {activeTab === 'items' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', width: '33%' }}>Item Details</th>
                  <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                  <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                  <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ divideY: '1px solid var(--border)' } as any}>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="group" style={{ transition: 'background 0.2s', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '3.5rem', height: '3.5rem', flexShrink: 0, borderRadius: '16px', background: 'var(--bg-sidebar)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s' }}>
                          {item.emoji}
                        </div>
                        <div>
                          <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {item.category.name}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {tenant?.currency} {Number(item.price).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {item.isAvailable ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle size={12} /> Available
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            <XCircle size={12} /> Hidden
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={() => setEditingIngredientsFor({ id: item.id, name: item.name })}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', background: 'var(--bg-sidebar)', color: 'var(--accent)', fontWeight: 800, fontSize: '0.75rem', borderRadius: '8px', transition: 'background 0.2s', border: 'none', cursor: 'pointer' }}
                          title="Manage Recipe"
                        >
                          <ListPlus size={14} /> Recipe
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.75rem', borderRadius: '8px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.75rem', borderRadius: '8px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No matching menu items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', padding: '1.5rem', background: 'var(--bg-deep)', minHeight: '400px' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ background: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s' }} className="group hover:shadow-md">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: '3.5rem', height: '3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: '1.5rem', transition: 'all 0.2s' }}>
                    {cat.icon}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => openEdit(cat)}
                      style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat._count.menuItems)}
                      style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                      title={cat._count.menuItems > 0 ? "Cannot delete category with items" : "Delete category"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{cat.name}</h4>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat._count.menuItems} Items</p>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
               <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <LayoutGrid size={48} style={{ marginBottom: '1rem', opacity: 0.5 }}/>
                  <p>No categories created yet.</p>
               </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', padding: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
          <form
            onSubmit={handleSubmit}
            style={{ width: '100%', maxWidth: '32rem', background: 'var(--bg-elevated)', borderRadius: '32px', padding: '2rem', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.1)', border: '1px solid var(--border)', position: 'relative', animation: 'scaleIn 0.2s ease-out' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {formData.id ? 'Edit' : 'Add New'} {activeTab === 'items' ? 'Menu Item' : 'Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
                className="hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
              {activeTab === 'items' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Item Name</label>
                      <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" placeholder="Classic Burger" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Price ({tenant?.currency})</label>
                      <input required type="number" step="0.01" value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})} className="form-input" style={{ fontFamily: 'monospace', fontWeight: 800 }} placeholder="10.00" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Category</label>
                      <select required value={formData.categoryId || ''} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="input-field cursor-pointer">
                        <option value="" disabled>Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Emoji Icon</label>
                      <input required type="text" value={formData.emoji || ''} onChange={e => setFormData({...formData, emoji: e.target.value})} className="form-input" style={{ fontSize: '1.25rem' }} placeholder="🍔" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Description</label>
                    <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="form-input" placeholder="Delicious beef patty with cheese..." />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} className="hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable ?? true}
                      onChange={e => setFormData({...formData, isAvailable: e.target.checked})}
                      style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>Item is currently available for ordering</span>
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Category Name</label>
                    <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input" placeholder="Beverages" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                     <div>
                       <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Emoji Icon</label>
                       <input required type="text" value={formData.icon || ''} onChange={e => setFormData({...formData, icon: e.target.value})} className="form-input" style={{ fontSize: '1.25rem' }} placeholder="🥤" />
                     </div>
                     <div>
                       <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Sort Display Order</label>
                       <input required type="number" value={formData.sortOrder ?? 0} onChange={e => setFormData({...formData, sortOrder: Number(e.target.value)})} className="form-input" style={{ fontFamily: 'monospace', fontWeight: 800 }} placeholder="0" />
                     </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 800, transition: 'background 0.2s', cursor: 'pointer' }}
                className="hover:bg-slate-50"
               >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 800 }}
              >
                <Save size={18} /> Save {activeTab === 'items' ? 'Item' : 'Category'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {editingIngredientsFor && createPortal(
        <IngredientEditor
          menuItemId={editingIngredientsFor.id}
          menuItemName={editingIngredientsFor.name}
          onClose={() => setEditingIngredientsFor(null)}
        />,
        document.body
      )}
    </div>
  );
};

export default Menu;
