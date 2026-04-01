import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  TrendingUp, ArrowUpRight, ArrowDownRight,
  CheckCircle, Loader2, Users, DollarSign, Activity,
  Sparkles, Clock, AlertCircle, AlertTriangle, CreditCard, Wallet, Smartphone, Target, Percent
} from 'lucide-react';

const RANGES = ['Yesterday', 'Today', 'Week', 'Month', 'Year'];
const RANGE_MAP: Record<string, string> = {
  Yesterday: 'yesterday', Today: 'today', Week: 'week', Month: 'month', Year: 'year'
};

const Dashboard: React.FC = () => {
  const { user, tenant } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('Today');

  if (user?.role === 'super_admin') {
    return <Navigate to="/super-admin" replace />;
  }

  if (user?.role === 'cashier') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', animation: 'fadeIn 0.5s ease-out' }}>
        <div style={{ padding: '2.5rem', background: 'var(--bg-elevated)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1rem' }}>
             <Sparkles size={18} /> CASHIER TERMINAL
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Welcome, <span style={{ color: 'var(--accent)' }}>{user?.name?.split(' ')[0]}</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 600, maxWidth: '600px' }}>
            You are securely logged into the Point of Sale system. Select a module below to begin operations.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[
            { title: 'Food & Drinks POS', desc: 'Ring up walk-in customers and process payments natively.', icon: Wallet, link: '/pos', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
            { title: 'Floor Plan / Tables', desc: 'Manage dine-in operations and table assignments.', icon: Target, link: '/floor-plan', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
            { title: 'Rooms Dashboard', desc: 'Post room service charges directly to guest folios.', icon: Smartphone, link: '/rooms', color: '#4338ca', bg: 'rgba(67,56,202,0.1)' },
            { title: 'Kitchen KDS', desc: 'View live order ticket preparation status.', icon: Activity, link: '/kds', color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' }
          ].map((action, i) => (
            <a key={i} href={action.link} className="card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', padding: '1.75rem', gap: '1.25rem', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '16px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <action.icon size={26} style={{ color: action.color }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{action.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600, lineHeight: 1.5 }}>{action.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  const fetchStats = useCallback(async (range: string) => {
    try {
      const res = await api.get(`/tenants/${user?.tenantId}/analytics/dashboard?range=${RANGE_MAP[range]}`);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (user?.tenantId) {
      setLoading(true);
      fetchStats(timeFilter);
      const interval = setInterval(() => fetchStats(timeFilter), 15000);
      return () => clearInterval(interval);
    }
  }, [user?.tenantId, timeFilter, fetchStats]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 className="animate-spin text-accent" size={32} />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Dashboard...</span>
      </div>
    );
  }

  // Real period-over-period deltas from API
  const d = stats?.deltas || {};
  const fmtDelta = (v: number | undefined) => {
    if (v === undefined || v === null) return { trend: '— vs prev', positive: true };
    return { trend: `${v >= 0 ? '+' : ''}${v}% vs prev`, positive: v >= 0 };
  };

  const kpis = [
    {
      label: 'Gross Revenue', value: stats?.totalRevenue || 0, isCurrency: true,
      icon: TrendingUp, ...fmtDelta(d.revenue),
      color: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.05) 100%)', border: 'rgba(245,158,11,0.2)'
    },
    {
      label: 'Processed Orders', value: stats?.totalOrders || 0, isCurrency: false,
      icon: CheckCircle, ...fmtDelta(d.orders),
      color: '#10b981', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.05) 100%)', border: 'rgba(16,185,129,0.2)'
    },
    {
      label: 'Avg. Ticket Size', value: stats?.avgOrderValue ? Math.round(stats.avgOrderValue) : 0, isCurrency: true,
      icon: DollarSign, ...fmtDelta(d.avgTicket),
      color: '#0ea5e9', gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(2,132,199,0.05) 100%)', border: 'rgba(14,165,233,0.2)'
    },
    {
      label: 'New Guests', value: stats?.newGuests || 0, isCurrency: false,
      icon: Users, ...fmtDelta(d.newGuests),
      color: '#6366f1', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(79,70,229,0.05) 100%)', border: 'rgba(99,102,241,0.2)'
    },
    {
      label: 'Voids & Comp', value: stats?.cancelledValue || 0, isCurrency: true,
      icon: AlertTriangle, label2: stats?.cancelledValue > 0 ? 'Review voids' : 'All clear',
      trend: stats?.cancelledValue > 0 ? '⚠ Review' : '✓ Perfect', positive: stats?.cancelledValue === 0,
      color: '#f43f5e', gradient: 'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(225,29,72,0.05) 100%)', border: 'rgba(244,63,94,0.2)'
    },
  ];

  const lineData: number[] = stats?.revenueByDay?.length ? stats.revenueByDay.map((d: any) => d.revenue) : Array(13).fill(0);
  const maxSale = Math.max(...lineData, 1000);
  const yScale = maxSale * 1.2;

  const donut = stats?.revenueDonut || { dineIn: 0, takeaway: 0, delivery: 0 };
  const dTotal = donut.dineIn + donut.takeaway + donut.delivery || 1;

  const employees = stats?.bestEmployees || [];
  const dishes = stats?.trendingDishes || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '3rem' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
             <Sparkles size={16} /> PERFORMANCE ANALYSIS
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Welcome back, <span style={{ color: 'var(--accent)' }}>{user?.name?.split(' ')[0]}</span>
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>
            Management interface for <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{tenant?.name}</span>
          </p>
        </div>
        
        <div style={{ display: 'flex', background: 'var(--bg-deep)', borderRadius: '16px', padding: '0.5rem', border: '1px solid var(--border)' }}>
          {RANGES.map(t => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              style={{
                padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 800,
                background: timeFilter === t ? 'var(--text-inverted)' : 'transparent',
                color: timeFilter === t ? 'var(--text-primary)' : '#64748b',
                boxShadow: timeFilter === t ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* KPI Bento Blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="card" style={{ 
            padding: '2.25rem', background: 'var(--bg-elevated)', borderRadius: '32px', 
            border: `1px solid ${kpi.border}`, boxShadow: `0 12px 30px -10px ${kpi.gradient.split(', ')[1].replace('0.12)', '0.1)')}`,
            display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
            animation: `fadeUp 0.5s ease-out ${i * 0.05}s both`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px)';
            e.currentTarget.style.boxShadow = `0 24px 40px -12px ${kpi.gradient.split(', ')[1].replace('0.12)', '0.25)')}`;
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.transform = 'translateY(0)';
             e.currentTarget.style.boxShadow = `0 12px 30px -10px ${kpi.gradient.split(', ')[1].replace('0.12)', '0.1)')}`;
          }}
          >
            {/* Ambient Base Glow */}
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: kpi.gradient, opacity: 0.7, pointerEvents: 'none' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '4rem', height: '4rem', borderRadius: '22px', background: 'var(--bg-deep)', border: `1px solid ${kpi.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <kpi.icon size={28} style={{ color: kpi.color }} strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 900, color: kpi.positive ? '#10b981' : '#f43f5e', padding: '8px 14px', borderRadius: '99px', background: 'var(--bg-deep)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                {kpi.trend} {kpi.positive ? <ArrowUpRight size={16} strokeWidth={3} /> : <ArrowDownRight size={16} strokeWidth={3} />}
              </div>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                {kpi.label}
              </p>
              <h3 style={{ fontSize: '2.75rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>
                {kpi.isCurrency ? <span style={{ fontSize: '1.4rem', verticalAlign: 'middle', marginRight: '6px', opacity: 0.4 }}>{tenant?.currency}</span> : ''}
                {kpi.value.toLocaleString()}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Data Visualization Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1.5rem' }}>
        <div className="card" style={{ 
          background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', 
          padding: '2.5rem', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 40px -12px rgba(0,0,0,0.04)',
          animation: 'fadeUp 0.6s ease-out 0.2s both'
        }}>
          <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.02em' }}>
                <Activity size={24} color="var(--accent)" /> Sales Velocity
              </h3>
              <p style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '6px' }}>Real-time transactional flow across active terminals</p>
            </div>
            <div style={{ padding: '8px 16px', background: 'var(--bg-deep)', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent-glow)' }} /> LIVE SYNC
            </div>
          </div>
          
          <div style={{ flex: 1, minHeight: '340px', position: 'relative' }}>
             {/* Y-Axis Metrics */}
             <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', paddingBottom: '2.5rem' }}>
              <span>{Math.round(yScale / 1000)}k</span>
              <span>{Math.round((yScale * 0.5) / 1000)}k</span>
              <span>0</span>
            </div>
            
            {/* Soft Grid Lines */}
            <div style={{ position: 'absolute', left: '3.5rem', right: 0, top: 0, bottom: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', borderBottom: '2px dashed var(--border)' }}>
               <div style={{ borderTop: '2px dashed var(--border)', opacity: 0.5, height: '1px', width: '100%' }} />
               <div style={{ borderTop: '2px dashed var(--border)', opacity: 0.5, height: '1px', width: '100%' }} />
               <div style={{ height: '1px' }} />
            </div>

            {/* Core SVG Render */}
            <div style={{ position: 'absolute', left: '3.5rem', right: 0, top: 0, bottom: '2.5rem' }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {/* Glowing Base Line */}
                <polyline
                  points={lineData.map((v, i) => `${(i / (lineData.length - 1)) * 100},${100 - (v / yScale) * 100}`).join(' ')}
                  fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 16px 20px var(--accent-glow)) drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="card" style={{ 
          background: 'var(--bg-sidebar)', borderRadius: '32px', padding: '2.5rem', color: 'white',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden',
          animation: 'fadeUp 0.6s ease-out 0.25s both'
        }}>
          {/* Subtle Graphic Wash */}
          <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '300px', height: '300px', background: 'var(--accent)', opacity: 0.15, filter: 'blur(80px)', borderRadius: '50%', pointerEvents: 'none' }} />

          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
            <Sparkles size={24} color="var(--accent)" /> Channel Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', position: 'relative', zIndex: 1 }}>
             {[
                { label: 'Dine-In', value: donut.dineIn, color: 'var(--accent)', icon: '🍽️' },
                { label: 'Takeaway', value: donut.takeaway, color: '#10b981', icon: '🛍️' },
                { label: 'Room Service', value: donut.delivery, color: '#3b82f6', icon: '🏨' },
              ].map((ch, i) => {
                const pct = (ch.value / dTotal) * 100;
                return (
                  <div key={i} style={{ group: true }} className="hover-lift">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '1.6rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}>{ch.icon}</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{ch.label}</span>
                       </div>
                       <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                       <div style={{ height: '100%', width: `${pct}%`, background: ch.color, borderRadius: '99px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 10px rgba(255,255,255,0.2)' }} />
                    </div>
                  </div>
                );
              })}
          </div>
          
          <div style={{ marginTop: 'auto', paddingTop: '4rem', position: 'relative', zIndex: 1 }}>
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.06)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <Clock size={16} color="var(--accent)" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.7, letterSpacing: '0.05em' }}>SYSTEM UPTIME</span>
               </div>
               <p style={{ fontSize: '1.05rem', fontWeight: 800 }}>Real-time data synced 2s ago</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.04)', animation: 'fadeUp 0.6s ease-out 0.3s both' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem' }}>Top Performers</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {employees.slice(0, 3).map((emp: any, i: number) => (
                <div key={i} className="hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderRadius: '24px', background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '18px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{emp.name}</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{emp.orders} orders processed</p>
                      </div>
                   </div>
                   <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{tenant?.currency} {Math.round(emp.sales).toLocaleString()}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.04)', animation: 'fadeUp 0.6s ease-out 0.35s both' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem' }}>Trending Items</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {dishes.slice(0, 3).map((dish: any, i: number) => (
                <div key={i} className="hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1 }}>
                      <span style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>{dish.emoji || '🥘'}</span>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '1rem' }}>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{dish.name}</p>
                        <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', marginTop: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                           <div style={{ height: '100%', width: `${(dish.count / Math.max(...dishes.map((d: any) => d.count))) * 100}%`, background: 'var(--accent)', borderRadius: '4px', boxShadow: '0 0 10px var(--accent-glow)' }} />
                        </div>
                      </div>
                   </div>
                   <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-primary)', marginLeft: '1rem' }}>{dish.count}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.04)', animation: 'fadeUp 0.6s ease-out 0.4s both' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f43f5e' }}>
             <AlertCircle size={22} /> Low Stock Alerts
           </h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {(stats?.lowStock || []).slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderRadius: '24px', background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)' }}>
                   <div style={{ minWidth: 0 }}>
                     <p style={{ fontWeight: 800, fontSize: '1.05rem', color: '#e11d48', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.name}</p>
                     <p style={{ fontSize: '0.85rem', color: '#f43f5e', fontWeight: 700, marginTop: '4px' }}>Threshold: {item.lowStockThreshold} {item.unit}</p>
                   </div>
                   <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '1rem' }}>
                     <p style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: '#f43f5e', letterSpacing: '0.05em' }}>Current</p>
                     <span style={{ fontWeight: 900, fontSize: '1.75rem', color: '#e11d48', lineHeight: 1 }}>{item.currentStock}</span>
                   </div>
                </div>
              ))}
              {(!stats?.lowStock || stats?.lowStock.length === 0) && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.05)', borderRadius: '24px', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                   <div style={{ padding: '1rem', background: '#10b981', borderRadius: '50%', color: 'white', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                     <CheckCircle size={28} />
                   </div>
                   <p>All inventory items are sufficiently stocked.</p>
                </div>
              )}
           </div>
        </div>
        
        <div className="card" style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.04)', animation: 'fadeUp 0.6s ease-out 0.45s both' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <Wallet size={22} color="var(--accent)" /> Payment Methods
           </h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
             {[
               { name: 'Cash', value: stats?.revenueByMethod?.cash || 0, icon: DollarSign, color: '#10b981' },
               { name: 'Card', value: stats?.revenueByMethod?.card || 0, icon: CreditCard, color: '#3b82f6' },
               { name: 'M-Pesa', value: stats?.revenueByMethod?.mpesa || 0, icon: Smartphone, color: '#f59e0b' }
             ].map((method, i) => {
                const total = (stats?.revenueByMethod?.cash || 0) + (stats?.revenueByMethod?.card || 0) + (stats?.revenueByMethod?.mpesa || 0);
                const pct = total > 0 ? (method.value / total) * 100 : 0;
                return (
                  <div key={i} className="hover-lift">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <method.icon size={20} color={method.color} strokeWidth={2.5} />
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{method.name}</span>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>{tenant?.currency} {method.value.toLocaleString()}</span>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 800 }}>{Math.round(pct)}%</div>
                       </div>
                    </div>
                    <div style={{ height: '10px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                       <div style={{ height: '100%', width: `${pct}%`, background: method.color, borderRadius: '99px', boxShadow: `0 0 10px ${method.color}66` }} />
                    </div>
                  </div>
                );
             })}
           </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.04)', animation: 'fadeUp 0.6s ease-out 0.5s both' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <Target size={22} color="var(--accent)" /> Floor Occupancy
           </h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {[
               { name: 'Restaurant Tables', active: stats?.occupancy?.tables?.active || 0, total: stats?.occupancy?.tables?.total || 0, icon: '🍽️', color: '#f59e0b' },
               { name: 'Hotel Rooms', active: stats?.occupancy?.rooms?.active || 0, total: stats?.occupancy?.rooms?.total || 0, icon: '🏨', color: '#8b5cf6' }
             ].map((zone, i) => {
                const pct = zone.total > 0 ? (zone.active / zone.total) * 100 : 0;
                return (
                  <div key={i} className="hover-lift" style={{ padding: '1.5rem', borderRadius: '24px', background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.75rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{zone.icon}</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{zone.name}</span>
                       </div>
                       <span style={{ fontSize: '1.5rem', fontWeight: 900, color: zone.color }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ flex: 1, height: '12px', background: 'var(--bg-elevated)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                         <div style={{ height: '100%', width: `${pct}%`, background: zone.color, borderRadius: '99px', boxShadow: `0 0 10px ${zone.color}66` }} />
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: '8px' }}>
                        {zone.active} / {zone.total}
                      </span>
                    </div>
                  </div>
                );
             })}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
