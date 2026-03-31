import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  TrendingUp, ArrowUpRight, ArrowDownRight,
  CheckCircle, Loader2, Users, DollarSign, Activity,
  Sparkles, Clock
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

  const kpis = [
    {
      label: 'Gross Revenue', value: stats?.totalRevenue || 0, isCurrency: true,
      icon: TrendingUp, trend: '+4.2%', positive: true, color: '#b8860b', bg: 'rgba(184,134,11,0.1)'
    },
    {
      label: 'Processed Orders', value: stats?.totalOrders || 0, isCurrency: false,
      icon: CheckCircle, trend: '+12.5%', positive: true, color: '#10b981', bg: 'rgba(16,185,129,0.1)'
    },
    {
      label: 'Avg. Ticket Size', value: stats?.avgOrderValue ? Math.round(stats.avgOrderValue) : 0, isCurrency: true,
      icon: DollarSign, trend: '+3.1%', positive: true, color: '#064e3b', bg: 'rgba(6,78,59,0.1)'
    },
    {
      label: 'New Guests', value: stats?.newGuests || 0, isCurrency: false,
      icon: Users, trend: '+5.7%', positive: true, color: '#4338ca', bg: 'rgba(67,56,202,0.1)'
    },
  ];

  const lineData: number[] = stats?.dailySales || Array(13).fill(0);
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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.75rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{ 
            padding: '2rem', background: 'var(--bg-elevated)', borderRadius: '32px', 
            border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
            display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '3.75rem', height: '3.75rem', borderRadius: '18px', background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.icon size={28} style={{ color: kpi.color }} strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 900, color: kpi.positive ? '#10b981' : '#f43f5e', padding: '6px 12px', borderRadius: '99px', background: kpi.positive ? '#f0fdf4' : '#fff1f2' }}>
                {kpi.trend} {kpi.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </div>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {kpi.label}
              </p>
              <h3 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
                {kpi.isCurrency ? <span style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginRight: '4px', opacity: 0.5 }}>{tenant?.currency}</span> : ''}
                {kpi.value.toLocaleString()}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.75rem' }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '3rem' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Activity size={24} color="var(--accent)" /> Sales Velocity
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>Real-time transactional flow across active terminals</p>
          </div>
          
          <div style={{ flex: 1, minHeight: '320px', position: 'relative' }}>
             <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', paddingBottom: '2.5rem' }}>
              <span>{Math.round(yScale / 1000)}k</span>
              <span>{Math.round((yScale * 0.5) / 1000)}k</span>
              <span>0</span>
            </div>
            
            <div style={{ position: 'absolute', left: '3.5rem', right: 0, top: 0, bottom: '2.5rem' }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <polyline
                  points={lineData.map((v, i) => `${(i / (lineData.length - 1)) * 100},${100 - (v / yScale) * 100}`).join(' ')}
                  fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 12px 16px var(--accent-glow))' }}
                />
              </svg>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-sidebar)', borderRadius: '32px', padding: '2.5rem', color: 'white' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={24} color="var(--accent)" /> Channel Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
             {[
                { label: 'Dine-In', value: donut.dineIn, color: 'var(--accent)', icon: '🍽️' },
                { label: 'Takeaway', value: donut.takeaway, color: '#10b981', icon: '🛍️' },
                { label: 'Room Service', value: donut.delivery, color: '#3b82f6', icon: '🏨' },
              ].map((ch, i) => {
                const pct = (ch.value / dTotal) * 100;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{ch.icon}</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800 }}>{ch.label}</span>
                       </div>
                       <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                       <div style={{ height: '100%', width: `${pct}%`, background: ch.color, borderRadius: '5px' }} />
                    </div>
                  </div>
                );
              })}
          </div>
          
          <div style={{ marginTop: '4rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Clock size={18} color="var(--accent)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.6 }}>SYSTEM UPTIME</span>
             </div>
             <p style={{ fontSize: '1rem', fontWeight: 800 }}>Real-time data synced 2s ago</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem' }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem' }}>Top Performers</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {employees.slice(0, 3).map((emp: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderRadius: '20px', background: 'var(--bg-deep)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ width: '3.25rem', height: '3.25rem', borderRadius: '16px', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem' }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem' }}>{emp.name}</p>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{emp.orders} orders processed</p>
                      </div>
                   </div>
                   <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--accent)' }}>{tenant?.currency} {Math.round(emp.sales).toLocaleString()}</span>
                </div>
              ))}
           </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '32px', border: '1px solid var(--border)', padding: '2.5rem' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '2rem' }}>Trending Items</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {dishes.slice(0, 3).map((dish: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <span style={{ fontSize: '2.25rem' }}>{dish.emoji || '🥘'}</span>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem' }}>{dish.name}</p>
                        <div style={{ width: '120px', height: '6px', background: 'var(--bg-deep)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                           <div style={{ height: '100%', width: `${(dish.count / Math.max(...dishes.map((d: any) => d.count))) * 100}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                   </div>
                   <span style={{ fontWeight: 900, fontSize: '1.5rem' }}>{dish.count}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
