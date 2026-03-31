import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Loader2, Users, Search, Plus, Star, Mail, Phone, 
  History, Trash2, Edit2, X, Save
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  loyaltyPoints: number;
}

const Guests: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Guest>>({ firstName: '', lastName: '', email: '', phone: '' });

  const fetchGuests = async () => {
    try {
      const res = await api.get(`/tenants/${user?.tenantId}/guests`);
      setGuests(res.data);
    } catch (err) {
      console.error('Failed to fetch guests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.tenantId) fetchGuests();
  }, [user?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.patch(`/tenants/${user?.tenantId}/guests/${formData.id}`, formData);
        showToast('Guest profile updated successfully', 'success');
      } else {
        await api.post(`/tenants/${user?.tenantId}/guests`, formData);
        showToast('Guest added to directory', 'success');
      }
      setIsModalOpen(false);
      fetchGuests();
    } catch (err) {
      console.error('Failed to save guest', err);
      showToast('Failed to save guest profile', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.delete(`/tenants/${user?.tenantId}/guests/${id}`);
      showToast('Guest removed from directory', 'success');
      fetchGuests();
    } catch (err) {
      console.error('Failed to delete guest', err);
      showToast('Failed to delete guest', 'error');
    }
  };

  const openEdit = (guest: Guest) => {
    setFormData(guest);
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setFormData({ firstName: '', lastName: '', email: '', phone: '' });
    setIsModalOpen(true);
  };

  const filteredGuests = guests.filter(g => 
    `${g.firstName} ${g.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (g.email && g.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (g.phone && g.phone.includes(searchQuery))
  );

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent)" />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Loading Directory...</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem', animation: 'fadeUp 0.4s ease-out' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', gap: '0.75rem', alignItems: 'center', letterSpacing: '-0.02em' }}>
            <div style={{ padding: '0.5rem', background: 'var(--accent-soft)', borderRadius: '12px' }}><Users className="text-accent" size={26}/></div>
            Guest CRM
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Profiles, contact details, and loyalty rewards.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} strokeWidth={3} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by name, email, or phone..." 
              className="form-input"
              style={{ paddingLeft: '3rem', borderRadius: '99px', background: 'var(--bg-elevated)', border: 'none', boxShadow: 'var(--shadow-sm)', fontSize: '0.9rem', padding: '0.75rem 1rem 0.75rem 3rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary"
            style={{ borderRadius: '99px', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
            onClick={openAdd}
          >
            <Plus size={18} /> New Guest
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {filteredGuests.map((guest, i) => (
          <div key={guest.id} className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', position: 'relative', animationDelay: `${(i % 12) * 0.05}s` }}>
            
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.5rem' }}>
               <button onClick={() => openEdit(guest)} style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'all 0.2s', cursor: 'pointer' }}><Edit2 size={14}/></button>
               <button onClick={() => handleDelete(guest.id, `${guest.firstName} ${guest.lastName}`)} style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e', transition: 'all 0.2s', cursor: 'pointer' }}><Trash2 size={14}/></button>
            </div>
            
            <div style={{ width: '4rem', height: '4rem', borderRadius: '16px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.1)' }}>
              {guest.firstName[0]}{guest.lastName[0]}
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>{guest.firstName} {guest.lastName}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', flex: 1 }}>
              {guest.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <Mail size={14} color="var(--text-muted)"/> {guest.email}
                </div>
              )}
              {guest.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <Phone size={14} color="var(--text-muted)"/> {guest.phone}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
                <Star size={14} style={{ fill: 'var(--accent)' }}/> 
                <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{guest.loyaltyPoints} pts</span>
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' }}>
                <History size={14}/> Folio
              </button>
            </div>

          </div>
        ))}
      </div>
      
      {filteredGuests.length === 0 && (
         <div className="card" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
           <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <Users size={36} color="var(--text-muted)" />
           </div>
           <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>No Guest Profiles</h3>
           <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No guests match your current filters.</p>
         </div>
      )}

      {isModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '28rem', padding: '2.5rem', animation: 'fadeUp 0.3s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users className="text-accent" size={24}/> {formData.id ? 'Edit Client Profile' : 'New Client Registration'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>First Name *</label>
                  <input required type="text" value={formData.firstName || ''} onChange={e => setFormData({...formData, firstName: e.target.value})} className="form-input" placeholder="John" style={{ padding: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Last Name *</label>
                  <input required type="text" value={formData.lastName || ''} onChange={e => setFormData({...formData, lastName: e.target.value})} className="form-input" placeholder="Doe" style={{ padding: '0.875rem' }} />
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Email Address</label>
                <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="form-input" placeholder="john.doe@example.com" style={{ padding: '0.875rem' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Mobile Number</label>
                <input type="tel" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="form-input" placeholder="+254 7XX XXX XXX" style={{ padding: '0.875rem' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Discard</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={18}/> {formData.id ? 'Save Changes' : 'Register'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Guests;
