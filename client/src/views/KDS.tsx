import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Clock, CheckCircle2, ChefHat, ArrowRight, AlertTriangle, Zap, Flame, Sparkles
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

const getMinutesSince = (dateStr: string) =>
  Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);

// ---------- Ticket Card ----------
const TicketCard = ({ t, nextStatus, nextLabel, nextIcon: Icon, accent, onAction }: {
  t: Ticket; nextStatus: string; nextLabel: string; nextIcon: any; accent: ColumnConfig; onAction: (id: string, status: string) => void;
}) => {
  const [elapsed, setElapsed] = useState(getMinutesSince(t.order.createdAt));
  useEffect(() => {
    const iv = setInterval(() => setElapsed(getMinutesSince(t.order.createdAt)), 30000);
    return () => clearInterval(iv);
  }, [t.order.createdAt]);

  const isOverdue = elapsed >= 10;
  const isUrgent = elapsed >= 15;
  const urgentColor = '#e11d48'; // Rose-600
  const overdueColor = '#d97706'; // Amber-600
  const timerColor = isUrgent ? urgentColor : isOverdue ? overdueColor : accent.color;

  return (
    <div style={{
      borderRadius: '20px',
      background: 'var(--bg-elevated)',
      border: `1px solid ${isUrgent ? urgentColor + '40' : 'var(--border)'}`,
      borderLeft: `5px solid ${timerColor}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.875rem',
      transition: 'all 0.3s ease',
      boxShadow: isUrgent ? `0 8px 24px ${urgentColor}20` : 'var(--shadow-sm)',
      animation: isUrgent ? 'kds-pulse-light 2s ease-in-out infinite' : 'none',
    }}>
      {/* Top row: order number + timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-secondary)'
          }}>
            #{t.order.orderNumber}
          </span>
          {isUrgent && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px',
              background: urgentColor + '15', color: urgentColor, border: `1px solid ${urgentColor}40`,
              animation: 'kds-blink 1s ease-in-out infinite', textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              <AlertTriangle size={10} /> LATE
            </span>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '99px',
          background: `${timerColor}15`, border: `1px solid ${timerColor}30`,
          color: timerColor, fontSize: '0.8rem', fontWeight: 800,
        }}>
          <Clock size={12} /> {elapsed}m
        </div>
      </div>

      {/* Item name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{t.menuItem.emoji}</span>
        <div>
          <p style={{
            fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', lineHeight: 1.1
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t.quantity}×</span> {t.menuItem.name}
          </p>
        </div>
      </div>

      {/* Notes / table / room */}
      {(t.notes || t.order.tableRef || t.order.roomId) && (
        <div style={{
          background: 'var(--bg-deep)', borderRadius: '12px',
          padding: '0.875rem', border: '1px solid var(--border)'
        }}>
          {t.notes && (
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: urgentColor, marginBottom: (t.order.tableRef || t.order.roomId) ? '0.5rem' : 0 }}>
              ⚠ {t.notes}
            </p>
          )}
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {t.order.tableRef && (
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Table</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t.order.tableRef}</p>
              </div>
            )}
            {t.order.roomId && (
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t.order.roomId}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={() => onAction(t.id, nextStatus)}
        style={{
          width: '100%', padding: '0.875rem', borderRadius: '14px',
          background: 'var(--bg-deep)',
          border: `2px solid ${accent.color}`,
          color: accent.color, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = accent.color;
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 20px ${accent.color}30`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-deep)';
          (e.currentTarget as HTMLButtonElement).style.color = accent.color;
          (e.currentTarget as HTMLButtonElement).style.transform = '';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
        }}
      >
        {nextLabel} <Icon size={16} />
      </button>
    </div>
  );
};

// ---------- Column config type ----------
interface ColumnConfig { color: string; bg: string; label: string; icon: any; emptyMsg: string; }

// ---------- Column ----------
const Column = ({ config, count, children }: { config: ColumnConfig; count: number; children: React.ReactNode }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', borderRadius: '28px', overflow: 'hidden',
    background: 'var(--bg-deep)',
    border: `1px solid var(--border)`,
    boxShadow: 'var(--shadow-sm)'
  }}>
    {/* Column header */}
    <div style={{
      padding: '1.25rem 1.5rem',
      background: 'var(--bg-elevated)',
      borderBottom: `1px solid var(--border)`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '12px',
          background: config.bg, color: config.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <config.icon size={20} />
        </div>
        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          {config.label}
        </h3>
      </div>
      <span style={{
        padding: '4px 14px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 800,
        background: config.bg, color: config.color,
      }}>
        {count}
      </span>
    </div>

    {/* Scrollable tickets */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {children}
    </div>
  </div>
);

// ---------- Empty State ----------
const EmptyState = ({ config }: { config: ColumnConfig }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '4rem 1rem', gap: '1rem', opacity: 0.6
  }}>
    <div style={{
      width: '72px', height: '72px', borderRadius: '50%',
      background: 'var(--bg-elevated)', border: `1px solid var(--border)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <config.icon size={32} color={config.color} />
    </div>
    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
      {config.emptyMsg}
    </p>
  </div>
);

// ---------- Main KDS ----------
const COLUMNS: { key: 'PENDING' | 'PREPARING' | 'READY'; config: ColumnConfig; nextStatus: string; nextLabel: string; nextIcon: any }[] = [
  {
    key: 'PENDING',
    config: { color: '#e11d48', bg: '#ffe4e6', label: 'New Orders', icon: Flame, emptyMsg: 'Intake clear — no new orders' },
    nextStatus: 'PREPARING', nextLabel: 'Start Prep', nextIcon: ChefHat,
  },
  {
    key: 'PREPARING',
    config: { color: '#d97706', bg: '#fef3c7', label: 'In Preparation', icon: ChefHat, emptyMsg: 'Kitchen standing by' },
    nextStatus: 'READY', nextLabel: 'Mark Ready', nextIcon: CheckCircle2,
  },
  {
    key: 'READY',
    config: { color: '#059669', bg: '#d1fae5', label: 'Ready to Pass', icon: CheckCircle2, emptyMsg: 'Pass is clear' },
    nextStatus: 'DELIVERED', nextLabel: 'Clear Ticket', nextIcon: ArrowRight,
  },
];

const KDS: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Live clock for status bar
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

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
      const interval = setInterval(fetchTickets, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.tenantId, fetchTickets]);

  const updateStatus = async (id: string, newStatus: string) => {
    const labels: Record<string, string> = {
      PREPARING: '🍳 Marked as Preparing',
      READY: '✅ Marked as Ready',
      DELIVERED: '🚀 Ticket cleared',
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

  const pending = tickets.filter(t => t.kitchenStatus === 'PENDING');
  const preparing = tickets.filter(t => t.kitchenStatus === 'PREPARING');
  const ready = tickets.filter(t => t.kitchenStatus === 'READY');
  const grouped: Record<string, Ticket[]> = { PENDING: pending, PREPARING: preparing, READY: ready };

  const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <>
      <style>{`
        @keyframes kds-pulse-light {
          0%, 100% { box-shadow: 0 4px 12px rgba(225,29,72,0.1); border-color: rgba(225,29,72,0.3); }
          50% { box-shadow: 0 8px 24px rgba(225,29,72,0.25); border-color: rgba(225,29,72,0.6); }
        }
        @keyframes kds-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes kds-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)',
        gap: '1.25rem', paddingBottom: '0.5rem',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '0.25rem'
            }}>
              <Sparkles size={14} /> Kitchen Operations
            </div>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>
              Live Orders
            </h2>
          </div>

          {/* Status bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1.5rem',
            padding: '0.75rem 1.5rem', borderRadius: '20px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Live clock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border)', paddingRight: '1.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'kds-dot 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
            </div>

            {/* Counters */}
            {[
              { label: 'New', count: pending.length, color: '#e11d48' },
              { label: 'Cooking', count: preparing.length, color: '#d97706' },
              { label: 'Ready', count: ready.length, color: '#059669' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: s.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {s.count} {s.label}
                </span>
              </div>
            ))}

            {/* Total */}
            <div style={{
              borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '6px',
              color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 800
            }}>
              <Zap size={14} style={{ color: 'var(--accent)' }} />
              {tickets.length} active
            </div>
          </div>
        </div>

        {/* ── Columns ── */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
            <Loader2 size={36} className="text-accent" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.95rem' }}>Syncing kitchen...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', flex: 1, minHeight: 0 }}>
            {COLUMNS.map(col => (
              <Column key={col.key} config={col.config} count={grouped[col.key].length}>
                {grouped[col.key].length === 0
                  ? <EmptyState config={col.config} />
                  : grouped[col.key].map(t => (
                    <TicketCard
                      key={t.id}
                      t={t}
                      nextStatus={col.nextStatus}
                      nextLabel={col.nextLabel}
                      nextIcon={col.nextIcon}
                      accent={col.config}
                      onAction={updateStatus}
                    />
                  ))
                }
              </Column>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default KDS;
