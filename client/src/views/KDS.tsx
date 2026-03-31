import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, UtensilsCrossed, Clock, CheckCircle2, ChefHat, ArrowRight, AlertTriangle, Sparkles
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Ticket {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  notes: string | null;
  kitchenStatus: 'PENDING' | 'PREPARING' | 'READY';
  order: {
    orderNumber: string;
    orderType: string;
    tableRef: string | null;
    roomId: string | null;
    createdAt: string;
  };
  menuItem: {
    name: string;
    emoji: string;
  };
}

const getMinutesSince = (dateStr: string) => {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
};

const TicketCard = ({ t, nextStatus, nextLabel, nextIcon: Icon, accentColor, onAction }: {
  t: Ticket;
  nextStatus: string;
  nextLabel: string;
  nextIcon: any;
  accentColor: string;
  onAction: (id: string, status: string) => void;
}) => {
  const minutesAgo = getMinutesSince(t.order.createdAt);
  const isOverdue = minutesAgo >= 10;
  const isUrgent = minutesAgo >= 15;

  return (
    <div className="glass" style={{
      padding: '1.25rem',
      borderRadius: '24px',
      border: `1px solid ${isUrgent ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.4)'}`,
      borderTop: `6px solid ${isUrgent ? '#f43f5e' : isOverdue ? '#f59e0b' : accentColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      animation: isUrgent ? 'pulse-border-red 2.5s infinite running' : 'none',
      boxShadow: isUrgent ? '0 8px 32px rgba(244,63,94,0.15)' : 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              #{t.order.orderNumber}
            </span>
            {isUrgent && (
              <span className="badge" style={{ background: '#f43f5e', color: 'white', border: 'none', animation: 'pulse 1.5s infinite' }}>
                <AlertTriangle size={10} /> CRITICAL
              </span>
            )}
          </div>
          <h4 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.02em' }}>
            <span style={{ fontSize: '2rem' }}>{t.menuItem.emoji}</span>
            <span style={{ color: 'var(--text-primary)' }}>{t.quantity}× {t.menuItem.name}</span>
          </h4>
        </div>
        <div className="glass" style={{
          padding: '0.375rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800,
          background: isUrgent ? 'rgba(244,63,94,0.1)' : isOverdue ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.6)',
          color: isUrgent ? '#f43f5e' : isOverdue ? '#f59e0b' : 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '0.375rem'
        }}>
          <Clock size={12} /> {minutesAgo}m
        </div>
      </div>

      {(t.notes || t.order.tableRef || t.order.roomId) && (
        <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255,255,255,0.5)' }}>
          {t.notes && (
            <div style={{ marginBottom: (t.order.tableRef || t.order.roomId) ? '0.75rem' : 0 }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>Chef Notes</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f43f5e' }}>{t.notes}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {t.order.tableRef && (
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Table</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 800 }}>{t.order.tableRef}</p>
              </div>
            )}
            {t.order.roomId && (
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 800 }}>{t.order.roomId}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => onAction(t.id, nextStatus)}
        className="btn"
        style={{
          width: '100%', padding: '1rem', borderRadius: '16px',
          background: accentColor === '#10b981' ? '#10b981' : 'var(--bg-elevated)',
          border: `2px solid ${accentColor}`,
          color: accentColor === '#10b981' ? 'white' : accentColor,
          fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = accentColor;
          (e.currentTarget as HTMLButtonElement).style.color = 'white';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 20px ${accentColor}40`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'none';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          if (accentColor !== '#10b981') {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
            (e.currentTarget as HTMLButtonElement).style.color = accentColor;
          }
        }}
      >
        {nextLabel} <Icon size={16} />
      </button>
    </div>
  );
};

const Column = ({ title, icon: Icon, color, bg, count, children }: {
  title: string; icon: any; color: string; bg: string; count: number; children: React.ReactNode;
}) => (
  <div className="glass" style={{ display: 'flex', flexDirection: 'column', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.4)', overflow: 'hidden', minHeight: 0 }}>
    <div style={{ padding: '1.5rem 1.75rem', background: 'rgba(255,255,255,0.4)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em', color }}>
        <Icon size={22} style={{ color }} /> {title}
      </h3>
      <span style={{ padding: '4px 12px', borderRadius: '99px', background: bg, color, fontSize: '0.8rem', fontWeight: 800, border: `1px solid ${color}30` }}>
        {count} Tickets
      </span>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {children}
    </div>
  </div>
);

const KDS: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get(`/tenants/${user?.tenantId}/kds/tickets`);
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to fetch KDS tickets', err);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (user?.tenantId) {
      fetchTickets();
      const interval = setInterval(fetchTickets, 5000); // refresh every 5s
      return () => clearInterval(interval);
    }
  }, [user?.tenantId, fetchTickets]);

  const updateStatus = async (id: string, newStatus: string) => {
    const labels: Record<string, string> = {
      PREPARING: '🍳 Marked as Preparing',
      READY: '✅ Marked as Ready',
      DELIVERED: '🚀 Delivered and cleared',
    };
    try {
      setTickets(prev =>
        newStatus === 'DELIVERED'
          ? prev.filter(t => t.id !== id)
          : prev.map(t => t.id === id ? { ...t, kitchenStatus: newStatus as any } : t)
      );
      await api.patch(`/tenants/${user?.tenantId}/kds/tickets/${id}`, { kitchenStatus: newStatus });
      showToast(labels[newStatus] || 'Status updated', 'success');
      fetchTickets();
    } catch {
      showToast('Failed to update ticket status', 'error');
      fetchTickets();
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin text-accent" size={32} />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Kitchen...</span>
    </div>
  );

  const pending = tickets.filter(t => t.kitchenStatus === 'PENDING');
  const preparing = tickets.filter(t => t.kitchenStatus === 'PREPARING');
  const ready = tickets.filter(t => t.kitchenStatus === 'READY');

  const EmptyState = ({ icon: Icon, message, color }: { icon: any; message: string; color: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', opacity: 0.6 }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
        <Icon size={32} color={color} />
      </div>
      <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>{message}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: 'calc(100vh - 4rem)', paddingBottom: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', flexShrink: 0 }}>
        <div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
             <Sparkles size={14} /> Kitchen Operations
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.04em' }}>
            Live Orders
          </h2>
        </div>
        
        <div className="glass" style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 1.5rem', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.4)' }}>
          {[
            { label: 'Pending', count: pending.length, color: '#f43f5e' },
            { label: 'Preparing', count: preparing.length, color: '#f59e0b' },
            { label: 'Ready', count: ready.length, color: '#10b981' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{s.count} {s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        <Column title="Intake / Pending" icon={Clock} color="#f43f5e" bg="rgba(244,63,94,0.1)" count={pending.length}>
          {pending.length === 0 ? <EmptyState icon={Clock} color="#f43f5e" message="Intake queue is clear" /> :
            pending.map(t => <TicketCard key={t.id} t={t} nextStatus="PREPARING" nextLabel="Start Prep" nextIcon={ChefHat} accentColor="#f43f5e" onAction={updateStatus} />)}
        </Column>
        <Column title="In Preparation" icon={ChefHat} color="#f59e0b" bg="rgba(245,158,11,0.1)" count={preparing.length}>
          {preparing.length === 0 ? <EmptyState icon={ChefHat} color="#f59e0b" message="Chef is standing by" /> :
            preparing.map(t => <TicketCard key={t.id} t={t} nextStatus="READY" nextLabel="Mark Ready" nextIcon={CheckCircle2} accentColor="#f59e0b" onAction={updateStatus} />)}
        </Column>
        <Column title="Pass / Ready" icon={CheckCircle2} color="#10b981" bg="rgba(16,185,129,0.1)" count={ready.length}>
          {ready.length === 0 ? <EmptyState icon={CheckCircle2} color="#10b981" message="The pass is currently empty" /> :
            ready.map(t => <TicketCard key={t.id} t={t} nextStatus="DELIVERED" nextLabel="Clear Ticket" nextIcon={ArrowRight} accentColor="#10b981" onAction={updateStatus} />)}
        </Column>
      </div>
    </div>
  );
};

export default KDS;
