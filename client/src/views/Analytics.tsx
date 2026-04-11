import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, PackageMinus, Award, Loader2,
  DollarSign, ShoppingCart, Tag, CreditCard, Banknote, Smartphone, Bed,
  ArrowUpRight, Sparkles
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  ComposedChart
} from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalDiscounts: number;
  newGuests: number;
  lowStock: any[];
  topItems: any[];
  revenueByDay: { date: string; revenue: number }[];
  revenueByMethod: Record<string, number>;
  revenueDonut: { dineIn: number; takeaway: number; delivery: number };
}

interface ForecastData {
  actuals: { date: string; revenue: number }[];
  forecast: { date: string; predictedRevenue: number }[];
}

const RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

const Analytics: React.FC = () => {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('week');
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/tenants/${user?.tenantId}/analytics/dashboard?range=${range}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.tenantId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user?.tenantId, range]);

  // Fetch AI forecast once on mount
  useEffect(() => {
    const fetchForecast = async () => {
      setForecastLoading(true);
      try {
        const res = await api.get(`/tenants/${user?.tenantId}/forecast`);
        setForecast(res.data);
      } catch (err) {
        console.error('Forecast fetch failed:', err);
      } finally {
        setForecastLoading(false);
      }
    };
    if (user?.tenantId) {
      fetchForecast();
    } else {
      setForecastLoading(false);
    }
  }, [user?.tenantId]);

  const cur = tenant?.currency || 'KES';

  const kpis = data ? [
    { label: 'Total Revenue', value: `${cur} ${data.totalRevenue.toLocaleString()}`, icon: DollarSign, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Total Orders', value: data.totalOrders.toLocaleString(), icon: ShoppingCart, color: '#6366f1', bg: '#ede9fe' },
    { label: 'Avg Order Value', value: `${cur} ${Math.round(data.avgOrderValue).toLocaleString()}`, icon: ArrowUpRight, color: '#10b981', bg: '#d1fae5' },
    { label: 'Discounts Given', value: `${cur} ${Math.round(data.totalDiscounts).toLocaleString()}`, icon: Tag, color: '#f43f5e', bg: '#fce7f3' },
    { label: 'New Guests', value: data.newGuests.toLocaleString(), icon: Award, color: '#f97316', bg: '#ffedd5' },
  ] : [];

  const paymentIcons: Record<string, any> = {
    cash: Banknote, card: CreditCard, mpesa: Smartphone, room_charge: Bed
  };

  const chartData = data?.revenueByDay?.map((d: any) => ({
    name: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    sales: d.revenue
  })) || [];

  const combinedForecast = forecast ? [
    ...forecast.actuals.slice(-7).map((d: any) => ({
      name: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      actual: d.revenue,
      predict: null
    })),
    ...forecast.forecast.map((d: any) => ({
      name: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      actual: null,
      predict: d.predictedRevenue
    }))
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BarChart3 size={28} style={{ color: 'var(--accent)' }} /> Advanced Analytics
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Deep insights into your hotel's performance.
          </p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '99px', padding: '0.25rem', gap: '0.15rem' }}>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)} style={{
              padding: '0.4rem 1rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
              background: range === r.value ? 'var(--accent)' : 'transparent',
              color: range === r.value ? 'var(--text-inverted)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Failed to load analytics data.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {kpis.map((kpi, i) => (
              <div key={i} className="dashboard-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="kpi-accent-bar" style={{ background: kpi.color }} />
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <kpi.icon size={18} style={{ color: kpi.color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Trend + Top Items */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
            {/* Revenue Bar Chart */}
            <div className="dashboard-card" style={{ padding: '1.5rem' }}>
              <p className="section-label">7-Day Trend</p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <TrendingUp size={18} style={{ color: '#10b981' }} /> Revenue Trend
              </h3>
              <div style={{ width: '100%', height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#b8860b" />
                        <stop offset="95%" stopColor="#fbbf24" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} dy={8} />
                    <RechartsTooltip cursor={{ fill: 'var(--bg-deep)' }} contentStyle={{ background: 'white', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 20px rgba(0,0,0,0.07)', padding: '8px 12px' }} formatter={(v: any) => [`${cur} ${Number(v).toLocaleString()}`, 'Revenue']} />
                    <Bar dataKey="sales" fill="url(#colorBar)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Items */}
            <div className="dashboard-card" style={{ padding: '1.5rem' }}>
              <p className="section-label">Best Sellers</p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Award size={18} style={{ color: '#f59e0b' }} /> Top Selling Items
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {data.topItems.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No sales data yet.</p>
                ) : data.topItems.slice(0, 6).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'var(--bg-deep)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ width: '1.6rem', height: '1.6rem', borderRadius: '6px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
                      #{i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{item.name}</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.quantity} units sold</p>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      {cur} {Math.round(item.revenue).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Methods + Low Stock */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Revenue by payment method */}
            <div className="dashboard-card" style={{ padding: '1.5rem' }}>
              <p className="section-label">Payment Breakdown</p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <CreditCard size={18} style={{ color: '#6366f1' }} /> Revenue by Payment Method
              </h3>
              {Object.keys(data.revenueByMethod).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>No payment data yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(data.revenueByMethod).map(([method, amount]) => {
                    const MethodIcon = paymentIcons[method] || CreditCard;
                    const total = Object.values(data.revenueByMethod).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (amount / total) * 100 : 0;
                    return (
                      <div key={method}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                            <MethodIcon size={14} style={{ color: 'var(--accent)' }} />
                            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{method.replace('_', ' ')}</span>
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{cur} {Math.round(amount).toLocaleString()}</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Low Stock Warnings */}
            <div className="dashboard-card" style={{ padding: '1.5rem' }}>
              <div className="kpi-accent-bar" style={{ background: data.lowStock.length > 0 ? '#f43f5e' : '#10b981' }} />
              <p className="section-label">Stock Status</p>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: data.lowStock.length > 0 ? '#e11d48' : '#059669' }}>
                <PackageMinus size={18} />
                {data.lowStock.length > 0 ? 'Critical Stock Warnings' : 'Inventory Healthy'}
              </h3>
              {data.lowStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#10b981' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
                  <p style={{ fontWeight: 700 }}>All items are well-stocked</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>No items below minimum threshold.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {data.lowStock.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{item.name}</p>
                        <p style={{ fontSize: '0.7rem', color: '#f43f5e', fontWeight: 600 }}>
                          {item.currentStock} / {item.lowStockThreshold} {item.unit} remaining
                        </p>
                      </div>
                      <div style={{ padding: '0.25rem 0.6rem', background: '#fce7f3', color: '#f43f5e', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        Low
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* AI 7-Day Sales Forecast */}
          <div className="dashboard-card" style={{ padding: '1.5rem' }}>
            <div className="kpi-accent-bar" style={{ background: 'linear-gradient(90deg, #0f766e, #6366f1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
              <div>
                <p className="section-label">AI Projections</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <Sparkles size={18} style={{ color: '#6366f1' }} /> AI 7-Day Revenue Forecast
                </h3>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.2rem 0.6rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '99px' }}>
                Linear Regression
              </span>
            </div>
            {forecastLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: '#6366f1' }} />
              </div>
            ) : !forecast ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No forecast data available yet. Needs at least 7 days of order history.</p>
            ) : (
              <div>
                <div style={{ width: '100%', height: '180px', marginTop: '0.5rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={combinedForecast} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPredict" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#818cf8" />
                          <stop offset="95%" stopColor="#4f46e5" />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} />
                      <RechartsTooltip contentStyle={{ background: 'white', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 20px rgba(0,0,0,0.07)' }} itemStyle={{ color: 'var(--text-primary)', fontWeight: 700 }} />
                      <Bar dataKey="actual" name="Actual Revenue" fill="var(--border)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="predict" name="Predicted Projection" fill="url(#colorPredict)" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '12px', height: '12px', background: 'var(--border)', borderRadius: '2px' }} />
                    Last 7 days (actual)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>
                    <div style={{ width: '12px', height: '12px', background: '#6366f1', borderRadius: '2px', opacity: 0.7, border: '1px dashed #6366f1' }} />
                    Next 7 days (predicted)
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  📈 Predicted revenue for next 7 days:{' '}
                  <strong style={{ color: '#6366f1' }}>
                    {cur} {forecast.forecast.reduce((s, d) => s + d.predictedRevenue, 0).toLocaleString()}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
