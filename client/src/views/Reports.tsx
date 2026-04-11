import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, Search, Calendar, Loader2, Clock, Activity,
  BarChart4, FileText, Receipt, PackageSearch, TrendingUp,
  Award, DollarSign, ShoppingCart, Tag, ArrowUpRight, X
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface OrderItem { name: string; quantity: number; }
interface Order {
  id: string; orderNumber: string; orderType: string; status: string; total: number;
  subtotal: number; taxAmount: number; discount: number; createdAt: string;
  cashier: { name: string }; room?: { number: string }; items: OrderItem[];
  payments: { method: string; amount: number }[];
}

interface ShiftSummary {
  grossSales: number; netSales: number; totalDiscounts: number; totalTax: number;
  voidedCount: number; voidedAmount: number; completedCount: number;
  byPaymentMethod: Record<string, number>;
}

interface TaxReport { taxableSales: number; taxCollected: number; orderCount: number; }
interface InventoryItemValuation { id: string; name: string; category: string; currentStock: number; costPrice: number; totalValue: number; }
interface InventoryValuation { totalValuation: number; items: InventoryItemValuation[]; }

interface AnalyticsData {
  totalRevenue: number; totalOrders: number; avgOrderValue: number; totalDiscounts: number; newGuests: number;
  lowStock: any[]; topItems: any[]; revenueByDay: { date: string; revenue: number }[];
  revenueByMethod: Record<string, number>;
}

interface PnlReport {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  totalAssetsOnHand: number;
  dailyTrend: { date: string, revenue: number, expenses: number, profit: number }[];
}

type Tab = 'visual' | 'history' | 'shift' | 'taxes' | 'inventory' | 'pnl';

const Reports: React.FC = () => {
  const { user, tenant } = useAuth();
  const { showToast } = useToast();
  
  const [tab, setTab] = useState<Tab>('history');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null);
  const [inventoryVal, setInventoryVal] = useState<InventoryValuation | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [pnlReport, setPnlReport] = useState<PnlReport | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = `?from=${dateFrom}&to=${dateTo}`;
        if (tab === 'visual') {
          const res = await api.get(`/tenants/${user.tenantId}/analytics/dashboard?range=month`);
          setAnalyticsData(res.data);
        } else if (tab === 'pnl') {
          const res = await api.get(`/tenants/${user.tenantId}/reports/pnl?days=30`);
          setPnlReport(res.data);
        } else if (tab === 'history') {
          const res = await api.get(`/tenants/${user.tenantId}/reports/orders${query}`);
          setOrders(res.data);
        } else if (tab === 'shift') {
          const res = await api.get(`/tenants/${user.tenantId}/reports/shift-summary${query}`);
          setShiftSummary(res.data);
        } else if (tab === 'taxes') {
          const res = await api.get(`/tenants/${user.tenantId}/reports/taxes${query}`);
          setTaxReport(res.data);
        } else if (tab === 'inventory') {
          const res = await api.get(`/tenants/${user.tenantId}/reports/inventory-valuation`);
          setInventoryVal(res.data);
        }
      } catch (err) {
        showToast('Failed to load report data', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.tenantId, dateFrom, dateTo, tab, showToast]);

  const handleExportCSV = async () => {
    try {
      let endpoint = '';
      if (tab === 'history') {
        endpoint = `/tenants/${user?.tenantId}/reports/orders?from=${dateFrom}&to=${dateTo}&format=csv`;
      } else if (tab === 'inventory') {
        endpoint = `/tenants/${user?.tenantId}/reports/inventory-valuation?format=csv`;
      }
      
      if (!endpoint) return;

      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', tab === 'history' ? `ServePoint-Orders-${dateFrom}.csv` : 'ServePoint-Inventory.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      showToast('Failed to download CSV', 'error');
    }
  };

  const filteredOrders = orders.filter((o: Order) => 
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.room?.number || '').includes(searchQuery)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'var(--accent-soft)', borderRadius: '12px' }}>
              <BarChart4 style={{ color: 'var(--accent)' }} size={26}/>
            </div>
            Advanced Reporting
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>
            Comprehensive financial and operational insights.
          </p>
        </div>
        
        {(tab === 'history' || tab === 'inventory') && (
          <button onClick={handleExportCSV} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-soft)', fontWeight: 800 }}>
            <Download size={18} /> {tab === 'history' ? 'Export Historical CSV' : 'Export Inventory CSV'}
          </button>
        )}
      </div>

      {/* TABS MENU */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'white', padding: '0.4rem', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', width: 'fit-content', boxShadow: 'var(--shadow-card)', overflowX: 'auto', maxWidth: '100%' }}>
        {[
          { id: 'visual', label: 'Overview Charts', icon: BarChart4 },
          { id: 'pnl', label: 'Executive P&L', icon: Activity },
          { id: 'history', label: 'Transaction History', icon: FileText },
          { id: 'shift', label: 'Z-Reading / Shift', icon: Receipt },
          { id: 'taxes', label: 'Tax & Compliance', icon: TrendingUp },
          { id: 'inventory', label: 'Inventory Valuation', icon: PackageSearch }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id as Tab)} 
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.15rem',
              borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, border: 'none', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.2s',
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
              boxShadow: tab === t.id ? '0 2px 8px rgba(184,134,11,0.25)' : 'none'
            }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* DATE FILTERS (Not shown for static tabs) */}
      {tab !== 'inventory' && tab !== 'visual' && tab !== 'pnl' && (
        <div style={{ display: 'flex', gap: '1rem', padding: '0.875rem 1.25rem', background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '14px', boxShadow: 'var(--shadow-card)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Date Range From</label>
            <input type="date" className="form-input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Date Range To</label>
            <input type="date" className="form-input" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem' }}>
          <Loader2 style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} size={32} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.9rem' }}>Compiling Report Data...</span>
        </div>
      ) : (
        <>
          {/* TAB: EXECUTIVE PNL */}
          {tab === 'pnl' && pnlReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                  <div className="kpi-accent-bar" style={{ background: '#10b981' }} />
                  <p className="section-label">30-Day Inflow</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Total Revenue</p>
                  <p style={{ fontSize: '2rem', fontWeight: 900, color: '#059669' }}>{tenant?.currency} {pnlReport.totalRevenue.toLocaleString()}</p>
                </div>
                
                <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                  <div className="kpi-accent-bar" style={{ background: '#f43f5e' }} />
                  <p className="section-label">30-Day Outflow</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Total Expenses</p>
                  <p style={{ fontSize: '2rem', fontWeight: 900, color: '#e11d48' }}>{tenant?.currency} {pnlReport.totalExpenses.toLocaleString()}</p>
                </div>

                <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                  <div className="kpi-accent-bar" style={{ background: pnlReport.netMargin > 0 ? '#10b981' : '#f43f5e' }} />
                  <p className="section-label">Profitability</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Net Profit Margin</p>
                  <p style={{ fontSize: '2rem', fontWeight: 900, color: pnlReport.netMargin > 0 ? '#059669' : '#e11d48' }}>{Math.round(pnlReport.netMargin)}%</p>
                </div>
                
                <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                  <div className="kpi-accent-bar" style={{ background: '#0ea5e9' }} />
                  <p className="section-label">Asset Value</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Cost of Goods on Hand</p>
                  <p style={{ fontSize: '2rem', fontWeight: 900, color: '#0ea5e9' }}>{tenant?.currency} {pnlReport.totalAssetsOnHand.toLocaleString()}</p>
                </div>
              </div>

              <div className="dashboard-card" style={{ padding: '2rem', overflowX: 'auto' }}>
                <p className="section-label">Financial Performance</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <Activity size={20} style={{ color: 'var(--accent)' }}/> 30-Day Revenue vs. Expenses
                </h3>
                
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={pnlReport.dailyTrend} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRevPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradExpPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="date"
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}
                      tickFormatter={(v: string) => v.substring(5, 10)}
                      interval={4}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      width={36}
                    />
                    <RechartsTooltip
                      contentStyle={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '10px 14px' }}
                      itemStyle={{ fontWeight: 700, fontSize: '0.85rem' }}
                      labelStyle={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}
                      formatter={(value: any, name: any) => [`${tenant?.currency} ${Number(value).toLocaleString()}`, name === 'revenue' ? 'Revenue' : 'Expenses']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#gradRevPnl)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gradExpPnl)" dot={false} activeDot={{ r: 5, fill: '#f43f5e' }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} /><span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Revenue (Cash In)</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f43f5e' }} /><span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Expenses (Cash Out)</span></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: VISUAL OVERVIEW */}
          {tab === 'visual' && analyticsData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Total Revenue', value: `${tenant?.currency} ${analyticsData.totalRevenue.toLocaleString()}`, icon: DollarSign, color: '#f59e0b', bg: '#fef3c7' },
                  { label: 'Total Orders', value: analyticsData.totalOrders.toLocaleString(), icon: ShoppingCart, color: '#6366f1', bg: '#ede9fe' },
                  { label: 'Avg Order', value: `${tenant?.currency} ${Math.round(analyticsData.avgOrderValue).toLocaleString()}`, icon: ArrowUpRight, color: '#10b981', bg: '#d1fae5' },
                  { label: 'Discounts', value: `${tenant?.currency} ${Math.round(analyticsData.totalDiscounts).toLocaleString()}`, icon: Tag, color: '#f43f5e', bg: '#fce7f3' },
                  { label: 'New Guests', value: analyticsData.newGuests.toLocaleString(), icon: Award, color: '#f97316', bg: '#ffedd5' }
                ].map((kpi, i) => (
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
                <div className="dashboard-card" style={{ padding: '1.5rem', flex: 2 }}>
                  <p className="section-label">Revenue Timeline</p>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}><TrendingUp size={18} style={{ color: '#10b981' }} /> 30-Day Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={analyticsData.revenueByDay.map((d: any) => ({ name: d.date.substring(5, 10), sales: d.revenue }))}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorBarRep" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#b8860b" />
                          <stop offset="95%" stopColor="#fbbf24" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" strokeDasharray="4 4" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={32} />
                      <RechartsTooltip
                        cursor={{ fill: 'var(--bg-deep)' }}
                        contentStyle={{ background: 'white', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 20px rgba(0,0,0,0.07)', padding: '8px 12px' }}
                        formatter={(v: any) => [`${tenant?.currency} ${Number(v).toLocaleString()}`, 'Revenue']}
                      />
                      <Bar dataKey="sales" fill="url(#colorBarRep)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="dashboard-card" style={{ padding: '1.5rem', flex: 1 }}>
                  <p className="section-label">Best Sellers</p>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}><Award size={18} style={{ color: '#f59e0b' }} /> Top Selling Items</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {analyticsData.topItems.slice(0, 5).map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', background: 'var(--bg-deep)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '6px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>#{i+1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{tenant?.currency} {Math.round(item.revenue).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRANSACTION HISTORY */}
          {tab === 'history' && (
            <div className="dashboard-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={18} />
                <input type="text" placeholder="Search by order # or room..." className="form-input" style={{ paddingLeft: '3rem' }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>

              <div style={{ overflowX: 'auto', margin: '0 -1.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Order #</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Date/Time</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Items</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>No orders found.</td></tr>
                    ) : (
                      filteredOrders.map((order: Order) => (
                        <tr key={order.id} onClick={() => setSelectedOrder(order)} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{order.orderNumber}</span></td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}><Calendar size={12} style={{ color: '#3b82f6' }}/> {new Date(order.createdAt).toLocaleDateString()}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}><Clock size={12}/> {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <span style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border)', background: 'var(--bg-deep)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
                              {order.orderType.replace('_', ' ')}{order.room && ` - Rm ${order.room.number}`}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                             <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                               {order.items.length} items {order.items.length > 0 && `• ${order.items[0].name.substring(0, 15)}...`}
                             </div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: 800, color: 'var(--accent)' }}>{tenant?.currency} {Number(order.total).toLocaleString()}</span></td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                             <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                               {order.payments.map((p: any, j: number) => (
                                 <span key={j} style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{p.method}</span>
                               ))}
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: SHIFT SUMMARY (Z-READING) */}
          {tab === 'shift' && shiftSummary && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: '#fdfbf7', padding: '3rem', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', border: '1px solid #e5e7eb', color: '#1f2937', fontFamily: '"Courier New", Courier, monospace' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px dashed #d1d5db', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem' }}>{tenant?.name || 'Hotel POS'}</h1>
                  <p style={{ fontSize: '0.9rem', fontWeight: 800, opacity: 0.75 }}>*** SHIFT Z-READING ***</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>Generated: {new Date().toLocaleString()}</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Period: {dateFrom} to {dateTo}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontWeight: 800, fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.75 }}>Transactions Completed</span><span>{shiftSummary.completedCount}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span style={{ opacity: 0.75 }}>Transactions Voided</span><span>{shiftSummary.voidedCount}</span></div>
                  
                  <div style={{ padding: '1rem 0', borderTop: '1px dashed #d1d5db', borderBottom: '1px dashed #d1d5db', margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.75 }}>Gross Sales</span><span>{tenant?.currency} {shiftSummary.grossSales.toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}><span style={{ opacity: 0.75 }}>- Discounts Applied</span><span>({tenant?.currency} {shiftSummary.totalDiscounts.toLocaleString()})</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}><span style={{ opacity: 0.75 }}>Total Net Sales</span><span style={{ fontSize: '1.1rem' }}>{tenant?.currency} {shiftSummary.netSales.toLocaleString()}</span></div>
                  </div>

                  <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <p style={{ textAlign: 'center', opacity: 0.6, marginBottom: '0.5rem', fontSize: '0.8rem' }}>--- BY PAYMENT TENDER ---</p>
                    {Object.entries(shiftSummary.byPaymentMethod).map(([method, amount]) => (
                      <div key={method} style={{ display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase' }}><span style={{ opacity: 0.75 }}>{method.replace('_', ' ')}</span><span>{tenant?.currency} {(amount as number).toLocaleString()}</span></div>
                    ))}
                    {Object.keys(shiftSummary.byPaymentMethod).length === 0 && <p style={{ textAlign: 'center', opacity: 0.5, fontStyle: 'italic' }}>No payments recorded</p>}
                  </div>

                  <div style={{ paddingTop: '1rem', borderTop: '2px solid #9ca3af', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                    <span>CASH DRAWER TOTAL</span>
                    <span>{tenant?.currency} {(shiftSummary.byPaymentMethod['cash'] || 0).toLocaleString()}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5, fontSize: '0.75rem' }}>
                  <p>*** END OF REPORT ***</p>
                  <p style={{ marginTop: '0.5rem' }}>Thank you for your business</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TAX & COMPLIANCE */}
          {tab === 'taxes' && taxReport && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                <div className="kpi-accent-bar" style={{ background: 'var(--accent)' }} />
                <p className="section-label">Taxable Base</p>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Taxable Sales</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>{tenant?.currency} {taxReport.taxableSales.toLocaleString()}</p>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.75rem' }}>Across {taxReport.orderCount} orders</p>
              </div>
              <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                <div className="kpi-accent-bar" style={{ background: '#6366f1' }} />
                <p className="section-label">Configuration</p>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Tax Rate</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1' }}>{tenant?.taxRate}%</p>
              </div>
              <div className="dashboard-card" style={{ padding: '1.5rem' }}>
                <div className="kpi-accent-bar" style={{ background: '#10b981' }} />
                <p className="section-label">Government Liability</p>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Tax Collected</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#059669' }}>{tenant?.currency} {taxReport.taxCollected.toLocaleString()}</p>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginTop: '0.75rem' }}>Liability for selected period</p>
              </div>
            </div>
          )}

          {/* TAB: INVENTORY VALUATION */}
          {tab === 'inventory' && inventoryVal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="dashboard-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div className="kpi-accent-bar" style={{ background: '#0ea5e9' }} />
                <div>
                  <p className="section-label">Cost of Goods</p>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.15rem', color: 'var(--text-primary)' }}>Total Assets on Hand (COGS)</h3>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Current value of all raw materials in inventory.</p>
                </div>
                <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0ea5e9' }}>{tenant?.currency} {inventoryVal.totalValuation.toLocaleString()}</div>
              </div>

              <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Item Asset</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Unit Cost Price</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Available Stock</th>
                      <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Total Asset Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryVal.items.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No inventory items found.</td></tr>
                    ) : (
                      inventoryVal.items.map((item: InventoryItemValuation) => (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>{item.name}</td>
                          <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{tenant?.currency} {item.costPrice.toLocaleString()}</td>
                          <td style={{ padding: '1rem 1.5rem' }}><span style={{ backgroundColor: 'var(--bg-deep)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid var(--border)' }}>{item.currentStock} {item.category}</span></td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 800, color: '#0ea5e9' }}>{tenant?.currency} {item.totalValue.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '32rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.3s ease-out', padding: 0 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '16px 16px 0 0' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={20} color="var(--accent)" /> Order {selectedOrder.orderNumber}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'var(--bg-deep)', border: 'none', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: 'var(--bg-deep)' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>Type: {selectedOrder.orderType.replace('_', ' ')}</span>
                <span style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>Status: {selectedOrder.status}</span>
                <span style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>Agent: {selectedOrder.cashier?.name}</span>
              </div>
              
              <p style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Folio Items</p>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} style={{ padding: '1rem 1.25rem', borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: 600 }}>Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: '0 0 16px 16px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                 <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Total</span>
                 <span style={{ fontWeight: 900, color: 'var(--accent)', fontSize: '1.75rem', lineHeight: 1, letterSpacing: '-0.02em' }}>{tenant?.currency || 'KES'} {Number(selectedOrder.total).toLocaleString()}</span>
               </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Reports;
