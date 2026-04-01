import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bed, User, Calendar, CheckCircle2, XCircle, AlertCircle, Loader2,
  MoreVertical, LogOut, CreditCard, Banknote, Smartphone, Plus, Settings
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface RoomCharge {
  id: string;
  amount: number;
  order: { orderNumber: string; total: number; createdAt: string; };
}

interface Room {
  id: string; number: string; type: string; status: 'available' | 'occupied' | 'maintenance';
  guestName?: string; checkedInAt?: string; roomCharges: RoomCharge[];
}

const Rooms: React.FC = () => {
  const { user, tenant } = useAuth();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied' | 'maintenance'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings'>('rooms');

  interface Booking {
    id: string; roomId: string; guestName: string; checkIn: string; checkOut: string;
    status: string; totalPrice: number; room: { number: string; type: string };
  }
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ 
    roomId: '', 
    guestName: '', 
    checkIn: new Date().toISOString().split('T')[0], 
    checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0], 
    totalPrice: 0, 
    notes: '' 
  });

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ number: '', type: '', floor: '' });

  const handleCreateRoom = async () => {
    if (!roomForm.number || !roomForm.type) {
      showToast('Room number and type are required', 'error');
      return;
    }
    try {
      await api.post(`/tenants/${user?.tenantId}/rooms`, roomForm);
      showToast(`Room ${roomForm.number} created successfully`, 'success');
      setShowRoomModal(false);
      setRoomForm({ number: '', type: '', floor: '' });
      fetchRooms();
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to create room', 'error');
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setRooms(res.data);
    } catch (err) {
      showToast('Failed to fetch rooms', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (user?.tenantId) { fetchRooms(); fetchBookings(); }
  }, [user?.tenantId]);

  const fetchBookings = async () => {
    try {
      const res = await api.get(`/tenants/${user?.tenantId}/rooms/bookings`);
      setBookings(res.data);
    } catch (e) { showToast('Failed to load bookings. Please refresh.', 'error'); }
  };

  const handleCreateBooking = async () => {
    if (!bookingForm.roomId || !bookingForm.guestName || !bookingForm.checkIn || !bookingForm.checkOut) {
      showToast('Please fill all required booking fields', 'error');
      return;
    }
    try {
      await api.post(`/tenants/${user?.tenantId}/rooms/bookings`, bookingForm);
      showToast(`Booking for ${bookingForm.guestName} confirmed`, 'success');
      setShowBookingModal(false);
      setBookingForm({ 
        roomId: '', 
        guestName: '', 
        checkIn: new Date().toISOString().split('T')[0], 
        checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0], 
        totalPrice: 0, 
        notes: '' 
      });
      fetchBookings();
    } catch { showToast('Failed to create booking', 'error'); }
  };

  const handleCheckout = async () => {
    if (!selectedRoom) return;
    setIsCheckingOut(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/rooms/${selectedRoom.id}/checkout`, { method: checkoutMethod });
      showToast(`Successfully checked out Room ${selectedRoom.number}`, 'success');
      setSelectedRoom(null);
      fetchRooms();
    } catch { showToast('Failed to finalize checkout', 'error'); } 
    finally { setIsCheckingOut(false); }
  };

  const statusColors = {
    available: { bg: 'rgba(34,197,94,0.1)', border: '#22c55e', text: '#16a34a' },
    occupied: { bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', text: '#2563eb' },
    maintenance: { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', text: '#dc2626' },
  };

  const statusIcons = {
    available: <CheckCircle2 size={14} />,
    occupied: <User size={14} />,
    maintenance: <AlertCircle size={14} />,
  };

  const roomTypes = ['all', ...Array.from(new Set(rooms.map(r => r.type)))];

  const filteredRooms = rooms.filter(room => {
    if (statusFilter !== 'all' && room.status !== statusFilter) return false;
    if (typeFilter !== 'all' && room.type !== typeFilter) return false;
    return true;
  });

  if (loading) return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin text-accent" size={48} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* Unified Command Center */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '24px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
        
        {/* Top Row: Title, Legend, Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--accent-soft)', borderRadius: '16px', color: 'var(--accent)' }}>
              <Bed size={28}/>
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>Hotel Property</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 500, fontSize: '0.85rem' }}>Allocations, checkouts, and room creation.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-deep)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></span> <span style={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Available</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }}></span> <span style={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Occupied</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></span> <span style={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Maintenance</span></div>
            </div>

            {/* Room Addition Button */}
            {((user?.role as string) === 'hotel_admin' || (user?.role as string) === 'system_admin' || (user?.role as string) === 'manager') && activeTab === 'rooms' && (
              <button onClick={() => setShowRoomModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', fontSize: '0.9rem' }}>
                <Plus size={18} /> Add Room
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Tabs & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-deep)', borderRadius: '12px', padding: '0.375rem' }}>
            <button onClick={() => setActiveTab('rooms')} style={{
              padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
              background: activeTab === 'rooms' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'rooms' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'rooms' ? 'var(--shadow-sm)' : 'none'
            }}>🛏️ Rooms</button>
            <button onClick={() => setActiveTab('bookings')} style={{
              padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
              background: activeTab === 'bookings' ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === 'bookings' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'bookings' ? 'var(--shadow-sm)' : 'none'
            }}>📅 Bookings</button>
          </div>

          {activeTab === 'rooms' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              {/* Status Segmented Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Status</span>
                <div style={{ display: 'flex', background: 'var(--bg-deep)', borderRadius: '12px', padding: '0.375rem', gap: '0.25rem', border: '1px solid var(--border)' }}>
                  {(['all', 'available', 'occupied', 'maintenance'] as const).map(status => (
                    <button key={status} onClick={() => setStatusFilter(status)} style={{
                      padding: '0.4rem 1rem', borderRadius: '8px', border: 'none', textTransform: 'capitalize', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                      background: statusFilter === status ? 'var(--bg-elevated)' : 'transparent',
                      color: statusFilter === status ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: statusFilter === status ? 'var(--shadow-sm)' : 'none'
                    }}>{status === 'all' ? 'All Status' : status}</button>
                  ))}
                </div>
              </div>

              <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

              {/* Category Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Category</span>
                <select 
                  value={typeFilter} 
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ 
                    padding: '0.5rem 2.5rem 0.5rem 1rem', 
                    borderRadius: '12px', 
                    fontSize: '0.8rem', 
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    background: 'var(--bg-deep)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1em',
                    outline: 'none',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {roomTypes.map(type => (
                    <option key={type} value={type} style={{ textTransform: 'capitalize' }}>
                      {type === 'all' ? 'All Categories' : type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bookings View */}
      {activeTab === 'bookings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeUp 0.4s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              Upcoming Reservations ({bookings.filter(b => b.status !== 'cancelled').length})
            </h3>
            <button className="btn-primary" onClick={() => setShowBookingModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Plus size={16} /> Guarantee Reservation
            </button>
          </div>

          {bookings.length === 0 ? (
            <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={32} style={{ opacity: 0.5 }} />
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Schedule is completely open.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {bookings.map((booking, i) => {
                const statusColor = { confirmed: '#22c55e', checked_in: 'var(--accent)', checked_out: '#94a3b8', cancelled: '#ef4444' }[booking.status] || '#94a3b8';
                return (
                  <div key={booking.id} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', animationDelay: `${i * 0.05}s` }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🛏️</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '0.125rem' }}>{booking.guestName}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Room {booking.room?.number}</span> ({booking.room?.type}) &nbsp;&bull;&nbsp; 
                        {new Date(booking.checkIn).toLocaleDateString()} &rarr; {new Date(booking.checkOut).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '0.3rem 0.75rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 800, background: `${statusColor}1a`, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${statusColor}` }}>
                        {booking.status.replace('_', ' ')}
                      </span>
                      <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                        KES {booking.totalPrice?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '32rem', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Calendar size={24} color="var(--accent)" /> Establish Reservation
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Room Designation</label>
                <select className="form-input" style={{ padding: '0.875rem' }} value={bookingForm.roomId} onChange={e => setBookingForm(f => ({ ...f, roomId: e.target.value }))}>
                  <option value="">Select Room Selection...</option>
                  {rooms.filter(r => r.status === 'available').map(r => <option key={r.id} value={r.id}>Room {r.number} ({r.type})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Principal Guest</label>
                <input type="text" className="form-input" style={{ padding: '0.875rem' }} placeholder="Full formal name" value={bookingForm.guestName} onChange={e => setBookingForm(f => ({ ...f, guestName: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Arrival</label>
                  <input type="date" className="form-input" style={{ padding: '0.875rem' }} value={bookingForm.checkIn} onChange={e => setBookingForm(f => ({ ...f, checkIn: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Departure</label>
                  <input type="date" className="form-input" style={{ padding: '0.875rem' }} value={bookingForm.checkOut} onChange={e => setBookingForm(f => ({ ...f, checkOut: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Tariff (KES)</label>
                <input type="number" className="form-input" style={{ padding: '0.875rem' }} min={0} value={bookingForm.totalPrice || ''} placeholder="0" onChange={e => setBookingForm(f => ({ ...f, totalPrice: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Requests / Notes</label>
                <textarea className="form-input" rows={3} value={bookingForm.notes} onChange={e => setBookingForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none', padding: '0.875rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBookingModal(false)}>Discard</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateBooking}>Confirm Reservation</button>
            </div>
          </div>
        </div>
      )}


      {/* Rooms Grid View */}
      {activeTab === 'rooms' && (
        filteredRooms.length === 0 ? (
          <div className="card" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={36} color="var(--text-muted)" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>No inventory matching criteria</h3>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Try altering your segment filters.</p>
            <button onClick={() => { setStatusFilter('all'); setTypeFilter('all'); }} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Clear Filters</button>
          </div>
        ) : (
          <div className="dashboard-kpi-grid">
            {filteredRooms.map((room, i) => {
              const sc = statusColors[room.status];
              const isSelected = selectedRoom?.id === room.id;
              return (
                <div 
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className="card"
                  style={{
                    padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', 
                    animationDelay: `${(i % 12) * 0.05}s`,
                    boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${sc.border}, 0 20px 40px rgba(0,0,0,0.1)` : undefined,
                    transform: isSelected ? 'translateY(-4px)' : undefined,
                    borderColor: isSelected ? sc.border : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {statusIcons[room.status]} {room.status}
                    </div>
                    <MoreVertical size={16} color="var(--text-muted)" />
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.05em', lineHeight: 1 }}>#{room.number}</p>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.4rem' }}>{room.type}</p>
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    {room.status === 'occupied' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           <div style={{ background: 'var(--accent-soft)', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={12} color="var(--accent)" /></div> 
                           {room.guestName}
                        </p>
                        {room.roomCharges.length > 0 && (
                          <p style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Banknote size={12} /> TAB: {tenant?.currency} {room.roomCharges.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ) : room.status === 'maintenance' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>
                         <AlertCircle size={14}/> Action Required
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                         <Bed size={14}/> Ready for allocation
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Create Room Modal */}
      {showRoomModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '30rem', padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1.5rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Bed size={24} color="var(--accent)" /> Establish New Room
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="responsive-grid">
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Room Identifier</label>
                  <input type="text" className="form-input" style={{ padding: '0.875rem' }} placeholder="e.g. 501" value={roomForm.number} onChange={e => setRoomForm(f => ({ ...f, number: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Floor Level</label>
                  <input type="number" className="form-input" style={{ padding: '0.875rem' }} placeholder="e.g. 5" value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Room Category / Type</label>
                <input type="text" list="room-types" className="form-input" style={{ padding: '0.875rem' }} placeholder="Type new or select existing" value={roomForm.type} onChange={e => setRoomForm(f => ({ ...f, type: e.target.value }))} />
                <datalist id="room-types">
                  {roomTypes.filter(t => t !== 'all').map(t => <option key={t} value={t} />)}
                </datalist>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>Tip: Creating a new category here automatically adds it to the system filters.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRoomModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateRoom}>Confirm Creation</button>
            </div>
          </div>
        </div>
      )}

      {/* Room Detail Sidebar Interface (Glassmorphic) */}
      {selectedRoom && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={() => setSelectedRoom(null)}></div>
          
          <div className="glass" style={{ width: '100%', maxWidth: '28rem', height: '100%', display: 'flex', flexDirection: 'column', animation: 'slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)', borderRight: 'none', borderTop: 'none', borderBottom: 'none', borderRadius: '24px 0 0 24px' }}>
            
            <div style={{ padding: '2.5rem 2.5rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>{selectedRoom.type} &bull; Lvl {Math.floor(Number(selectedRoom.number)/100)}</p>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>Room {selectedRoom.number}</h3>
              </div>
              <button 
                onClick={() => setSelectedRoom(null)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }}
              >
                <XCircle size={24} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Status Section */}
              <div>
                <h4 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>System Status</h4>
                <div style={{ padding: '1rem', borderRadius: '16px', border: `1px solid ${statusColors[selectedRoom.status].border}`, background: statusColors[selectedRoom.status].bg, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.75rem', borderRadius: '12px', color: statusColors[selectedRoom.status].text }}>
                    {statusIcons[selectedRoom.status]}
                  </div>
                  <span style={{ fontWeight: 800, textTransform: 'capitalize', fontSize: '1.1rem', color: statusColors[selectedRoom.status].text }}>{selectedRoom.status}</span>
                </div>
              </div>

              {selectedRoom.status === 'occupied' ? (
                <>
                  <div>
                    <h4 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Current Guest</h4>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><User size={24} /></div>
                        <div>
                          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Occupant</p>
                          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{selectedRoom.guestName}</p>
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <Calendar size={16} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Arrived: {selectedRoom.checkedInAt ? new Date(selectedRoom.checkedInAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Room Folio</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {!selectedRoom.roomCharges || selectedRoom.roomCharges.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-deep)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>Zero outstanding folio charges.</p>
                        </div>
                      ) : (
                        selectedRoom.roomCharges.map(charge => (
                          <div key={charge.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Banknote size={16}/></div>
                              <div>
                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{charge.order?.orderNumber}</p>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{charge.order?.createdAt ? new Date(charge.order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                              </div>
                            </div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{tenant?.currency} {Number(charge.amount).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', borderRadius: '24px', border: '1px dashed var(--border)', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ width: '5rem', height: '5rem', borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem' }}>
                    <Settings size={32} color="var(--text-muted)" />
                  </div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Awaiting Allocation</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2rem' }}>Room is prepped and flagged available in the system.</p>
                  
                  <button 
                    onClick={() => {
                      setBookingForm(f => ({ ...f, roomId: selectedRoom.id }));
                      setShowBookingModal(true);
                      setSelectedRoom(null); // Close panel to show modal clearly
                    }}
                    className="btn-primary" 
                    style={{ padding: '0.875rem 2rem', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 800, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  >
                    <Plus size={18} /> Book This Room
                  </button>
                </div>
              )}
            </div>


            {selectedRoom.status === 'occupied' && (
              <div style={{ padding: '2rem 2.5rem', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Folio Balance</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                    <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginRight: '0.25rem', verticalAlign: 'top' }}>{tenant?.currency}</span>
                    {(selectedRoom.roomCharges || []).reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {(['cash', 'card', 'mpesa'] as const).map(m => (
                    <button 
                      key={m}
                      onClick={() => setCheckoutMethod(m)}
                      style={{
                        padding: '1rem 0', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', border: '2px solid', transition: 'all 0.2s', cursor: 'pointer',
                        background: checkoutMethod === m ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                        borderColor: checkoutMethod === m ? 'var(--bg-inverted)' : 'transparent',
                        color: checkoutMethod === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {m === 'cash' ? <Banknote size={20}/> : m === 'card' ? <CreditCard size={20}/> : <Smartphone size={20}/>}
                      {m}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleCheckout} disabled={isCheckingOut} className="btn btn-primary"
                  style={{ width: '100%', padding: '1.25rem', fontSize: '1rem', fontWeight: 800, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                >
                  {isCheckingOut ? <Loader2 className="animate-spin" size={20} /> : <><LogOut size={20} /> Finalize Checkout</>}
                </button>
              </div>
            )}
          </div>
          
          <style>{`
            @keyframes slideLeft {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Rooms;
