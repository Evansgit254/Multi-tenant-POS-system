import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
  Building2, Plus, CheckCircle2, XCircle,
  Loader2, Edit3, X, Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number; orders: number };
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block'
};

const SuperAdmin: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newTenant, setNewTenant] = useState({ name: '', slug: '', currency: 'KES', taxRate: 16 });
  const [editData, setEditData] = useState<Partial<Tenant>>({});

  const fetchTenants = useCallback(async () => {
    try {
      const res = await api.get('/tenants');
      setTenants(res.data);
    } catch {
      showToast('Failed to load tenants', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user?.role === 'super_admin') fetchTenants();
  }, [user, fetchTenants]);

  const handleCreate = async () => {
    if (!newTenant.name.trim() || !newTenant.slug.trim()) {
      showToast('Name and slug are required', 'error'); return;
    }
    setIsSaving(true);
    try {
      await api.post('/tenants', newTenant);
      showToast('Tenant registered successfully!', 'success');
      setShowCreateModal(false);
      setNewTenant({ name: '', slug: '', currency: 'KES', taxRate: 16 });
      fetchTenants();
    } catch (err) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? (err as Record<string, any>).response?.data?.error || 'Failed to create tenant'
        : 'Failed to create tenant';
      showToast(errorMsg, 'error');
    } finally { setIsSaving(false); }
  };

  const handleUpdate = async () => {
    if (!selectedTenant) return;
    setIsSaving(true);
    try {
      await api.patch(`/tenants/${selectedTenant.id}`, editData);
      showToast('Tenant updated!', 'success');
      setShowManageModal(false);
      fetchTenants();
    } catch {
      showToast('Failed to update tenant', 'error');
    } finally { setIsSaving(false); }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    try {
      await api.patch(`/tenants/${tenant.id}`, { isActive: !tenant.isActive });
      showToast(`Tenant ${tenant.isActive ? 'disabled' : 'enabled'}`, 'success');
      fetchTenants();
    } catch {
      showToast('Failed to update tenant status', 'error');
    }
  };

  const openManage = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditData({ name: tenant.name, currency: tenant.currency, taxRate: tenant.taxRate });
    setShowManageModal(true);
  };

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" size={48} style={{ color: 'var(--accent)' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Building2 size={28} style={{ color: 'var(--accent)' }} /> System Tenants
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage all hotels and restaurants registered on the platform.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Register Tenant
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Total Tenants', value: tenants.length, icon: Building2, color: '#6366f1', bg: '#ede9fe' },
          { label: 'Active', value: tenants.filter(t => t.isActive).length, icon: CheckCircle2, color: '#10b981', bg: '#d1fae5' },
          { label: 'Inactive', value: tenants.filter(t => !t.isActive).length, icon: XCircle, color: '#f43f5e', bg: '#fce7f3' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tenants Grid */}
      {tenants.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Building2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>No tenants registered yet</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Click "Register Tenant" to add the first hotel or restaurant.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {tenants.map(tenant => (
            <div key={tenant.id} className="card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.15s ease', border: tenant.isActive ? '1px solid var(--border)' : '1px solid rgba(244,63,94,0.2)', opacity: tenant.isActive ? 1 : 0.7 }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '0.95rem' }}>{tenant.name}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{tenant.slug}.servepoint.app</p>
                  </div>
                </div>
                <span style={{
                  padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                  background: tenant.isActive ? '#d1fae5' : '#fce7f3',
                  color: tenant.isActive ? '#059669' : '#f43f5e',
                  border: `1px solid ${tenant.isActive ? '#a7f3d0' : '#fecdd3'}`,
                }}>
                  {tenant.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '1rem' }}>
                {[
                  { label: 'Currency', value: tenant.currency },
                  { label: 'Tax Rate', value: `${tenant.taxRate}%` },
                  { label: 'Users', value: tenant._count?.users ?? '–' },
                ].map(stat => (
                  <div key={stat.label} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{stat.label}</p>
                    <p style={{ fontWeight: 800, fontSize: '0.9rem' }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.5rem' }}
                  onClick={() => openManage(tenant)}
                >
                  <Edit3 size={14} /> Manage
                </button>
                <button
                  onClick={() => handleToggleActive(tenant)}
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                    color: tenant.isActive ? '#f43f5e' : '#10b981', fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  {tenant.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="glass" style={{ width: '440px', padding: '1.75rem', borderRadius: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={20} style={{ color: 'var(--accent)' }} /> Register New Tenant
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Hotel / Restaurant Name *</label>
                <input className="form-input" placeholder="e.g. Lakeside Grand Hotel" value={newTenant.name}
                  onChange={e => { setNewTenant(p => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })); }} />
              </div>
              <div>
                <label style={labelStyle}>URL Slug *</label>
                <input className="form-input" placeholder="e.g. lakeside-grand" value={newTenant.slug}
                  onChange={e => setNewTenant(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                  {newTenant.slug || 'your-slug'}.servepoint.app
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <input className="form-input" maxLength={3} value={newTenant.currency}
                    onChange={e => setNewTenant(p => ({ ...p, currency: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label style={labelStyle}>Tax Rate (%)</label>
                  <input type="number" className="form-input" value={newTenant.taxRate}
                    onChange={e => setNewTenant(p => ({ ...p, taxRate: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleCreate} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={isSaving}>
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Register</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Modal */}
      {showManageModal && selectedTenant && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="glass" style={{ width: '440px', padding: '1.75rem', borderRadius: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} style={{ color: 'var(--accent)' }} /> Manage: {selectedTenant.name}
              </h3>
              <button onClick={() => setShowManageModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Hotel Name</label>
                <input className="form-input" value={(editData.name as string) || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <input className="form-input" maxLength={3} value={(editData.currency as string) || ''} onChange={e => setEditData(p => ({ ...p, currency: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label style={labelStyle}>Tax Rate (%)</label>
                  <input type="number" className="form-input" value={(editData.taxRate as number) || 0} onChange={e => setEditData(p => ({ ...p, taxRate: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Users</p>
                  <p style={{ fontWeight: 800, fontSize: '1.25rem' }}>{selectedTenant._count?.users ?? 0}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Orders</p>
                  <p style={{ fontWeight: 800, fontSize: '1.25rem' }}>{selectedTenant._count?.orders ?? 0}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button onClick={() => setShowManageModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleUpdate} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={isSaving}>
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
