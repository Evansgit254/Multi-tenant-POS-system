import React, { useState, useEffect, useCallback } from 'react';
import {
  User, Bell, Palette, ShoppingBag, Shield, Globe,
  Loader2, Monitor, Smartphone, Sun, Moon, ChevronRight, ArrowLeft,
  CreditCard, Banknote, Smartphone as Phone, Building2,
  CheckCircle2, AlertCircle, X as XIcon
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  { id: 'profile', label: 'Identity', icon: User },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'appearance', label: 'Vibe', icon: Palette },
  { id: 'checkout', label: 'POS Flow', icon: ShoppingBag },
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  { id: 'security', label: 'Vault', icon: Shield },
  { id: 'language', label: 'Region', icon: Globe },
];

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    style={{
      position: 'relative', width: '3.5rem', height: '1.8rem', flexShrink: 0,
      borderRadius: '99px', border: 'none', cursor: 'pointer',
      background: checked ? 'var(--accent)' : '#e2e8f0',
      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: '4px',
      left: checked ? 'calc(100% - 25px)' : '4px',
      width: '21px', height: '21px', borderRadius: '50%',
      background: 'var(--bg-elevated)', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
    }} />
  </button>
);

const DEFAULT_PREFS = {
  notifications: {
    newMessages: { push: true, email: false },
    weeklyReport: { push: true, email: true },
    paymentSuccess: { push: false, email: true },
    billingAlert: { push: true, email: false },
    newInventory: { push: false, email: true },
  },
  theme: 'light',
  checkout: {
    enableCard: true,
    enableCash: true,
    enableMpesa: true,
    enableRoomCharge: true,
  },
  currency: 'KES',
  timezone: 'Africa/Nairobi',
  language: 'English',
};

const Settings: React.FC = () => {
  const { user, tenant } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Tenant data (profile section)
  const [tenantData, setTenantData] = useState({
    name: '', currency: 'KES', taxRate: 16, receiptFooter: ''
  });
  const [profileName, setProfileName] = useState('');
  const [userStats, setUserStats] = useState({ totalOrders: 0, totalRevenue: 0, memberSince: '' });

  // Preferences (loaded from backend)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  // M-Pesa config state
  const [mpesaConfig, setMpesaConfig] = useState({
    mpesaConsumerKey: '', mpesaConsumerSecret: '', mpesaShortcode: '',
    mpesaPasskey: '', mpesaTillDisplay: ''
  });
  const [mpesaConfigured, setMpesaConfigured] = useState(false);
  const [isSavingMpesa, setIsSavingMpesa] = useState(false);
  const [mpesaSaveMsg, setMpesaSaveMsg] = useState('');

  const fetchAll = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const [settingsRes, prefsRes, statsRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/settings`),
        api.get(`/tenants/${user.tenantId}/users/me/preferences`),
        api.get(`/tenants/${user.tenantId}/users/me/stats`),
      ]);

      // Pre-populate visible (non-secret) M-Pesa fields
      const s = settingsRes.data;
      setMpesaConfig(prev => ({
        ...prev,
        mpesaTillDisplay: s.mpesaTillDisplay || '',
        mpesaShortcode: s.mpesaShortcode || '',
        // keys/passkey deliberately left blank — never sent back from server
      }));
      setMpesaConfigured(!!(s.mpesaConsumerKey && s.mpesaShortcode));

      setTenantData({
        name: settingsRes.data.name || '',
        currency: settingsRes.data.currency || 'KES',
        taxRate: settingsRes.data.taxRate || 16,
        receiptFooter: settingsRes.data.receiptFooter || '',
      });
      setProfileName(user?.name || '');

      // Merge saved preferences with defaults
      const savedPrefs = prefsRes.data || {};
      const loadedTheme = savedPrefs.theme || 'light';
      
      setPrefs(prev => ({
        notifications: savedPrefs.notifications || prev.notifications,
        theme: loadedTheme,
        checkout: savedPrefs.checkout || prev.checkout,
        currency: savedPrefs.currency || settingsRes.data.currency || prev.currency,
        timezone: savedPrefs.timezone || prev.timezone,
        language: savedPrefs.language || prev.language,
      }));
      
      // Instantly apply the loaded theme
      localStorage.setItem('app_theme', loadedTheme);
      if (loadedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      if (statsRes.data) {
        setUserStats({
          totalOrders: statsRes.data.totalOrders || 0,
          totalRevenue: statsRes.data.totalRevenue || 0,
          memberSince: statsRes.data.memberSince || '',
        });
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, user?.name]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const savePrefs = async (updates: Partial<typeof prefs>) => {
    setIsSaving(true); setSaveMsg('');
    try {
      await api.patch(`/tenants/${user?.tenantId}/users/me/preferences`, updates);
      setPrefs(prev => ({ ...prev, ...updates }));
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch { setSaveMsg('Save failed'); }
    finally { setIsSaving(false); }
  };

  const saveTenant = async () => {
    setIsSaving(true); setSaveMsg('');
    try {
      await api.patch(`/tenants/${user?.tenantId}/settings`, tenantData);
      await api.put(`/tenants/${user?.tenantId}/users/profile`, { name: profileName });
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch { setSaveMsg('Save failed'); }
    finally { setIsSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent)" />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Loading Settings...</span>
    </div>
  );

  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: '#94a3b8', marginBottom: '0.75rem', display: 'block'
  };

  const SaveBar = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
      {saveMsg && <span style={{ fontSize: '0.95rem', fontWeight: 800, color: saveMsg === 'Saved!' ? '#10b981' : '#f43f5e' }}>{saveMsg}</span>}
      <button onClick={saveTenant} className="btn btn-primary" style={{ height: '56px', minWidth: '200px', borderRadius: '16px', fontSize: '1rem', fontWeight: 900 }}>
        {isSaving ? <Loader2 size={20} className="animate-spin" /> : 'Save Changes'}
      </button>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {

      case 'profile':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '2.5rem', letterSpacing: '-0.03em' }}>Identity & Access</h3>
            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
              {/* Avatar card */}
              <div style={{ width: '260px', borderRadius: '28px', padding: '2rem', textAlign: 'center', flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
                <div style={{ width: '7rem', height: '7rem', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2.5rem', border: '4px solid white', boxShadow: '0 8px 24px var(--accent-glow)' }}>
                  <span style={{ color: 'white', fontWeight: 900 }}>{profileName?.charAt(0) || '?'}</span>
                </div>
                <p style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.25rem' }}>{profileName}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'capitalize', marginBottom: '1.5rem' }}>{user?.role?.replace('_', ' ')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '0', background: 'var(--bg-elevated)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--accent)' }}>{userStats.totalOrders.toLocaleString()}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>Orders</p>
                  </div>
                  <div style={{ background: '#e2e8f0' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--accent)' }}>{(userStats.totalRevenue / 1000).toFixed(1)}k</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>Revenue</p>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Member since {userStats.memberSince ? new Date(userStats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>

              {/* Fields */}
              <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" className="form-input" style={{ height: '56px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)' }} value={profileName} onChange={e => setProfileName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Hotel / Business Name</label>
                  <input type="text" className="form-input" style={{ height: '56px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)' }} value={tenantData.name} onChange={e => setTenantData({ ...tenantData, name: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <label style={labelStyle}>Currency</label>
                    <input type="text" className="form-input" style={{ height: '56px', borderRadius: '14px', fontWeight: 900, textAlign: 'center', background: 'var(--bg-deep)' }} value={tenantData.currency} onChange={e => setTenantData({ ...tenantData, currency: e.target.value.toUpperCase() })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tax Rate (%)</label>
                    <input type="number" className="form-input" style={{ height: '56px', borderRadius: '14px', fontWeight: 900, textAlign: 'center', background: 'var(--bg-deep)' }} value={tenantData.taxRate} onChange={e => setTenantData({ ...tenantData, taxRate: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Receipt Footer Message</label>
                  <input type="text" className="form-input" style={{ height: '56px', borderRadius: '14px', fontWeight: 700, background: 'var(--bg-deep)' }} value={tenantData.receiptFooter} onChange={e => setTenantData({ ...tenantData, receiptFooter: e.target.value })} placeholder="Thank you for your visit!" />
                </div>
              </div>
            </div>
            <SaveBar />
          </div>
        );

      case 'notifications':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>Notification Preferences</h3>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '3rem', fontWeight: 600 }}>Choose how you want to be notified. Changes are saved automatically.</p>
            <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', padding: '1.25rem 2rem', background: 'var(--bg-deep)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Notification</span>
                {['Push', 'Email'].map(h => <span key={h} style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</span>)}
              </div>
              {([
                { key: 'newMessages', label: 'New messages', desc: 'Internal team communications' },
                { key: 'weeklyReport', label: 'Weekly report', desc: 'Performance summary each week' },
                { key: 'paymentSuccess', label: 'Payment success', desc: 'Confirmed transaction alerts' },
                { key: 'billingAlert', label: 'Billing alert', desc: 'Payment failures or issues' },
                { key: 'newInventory', label: 'Low inventory', desc: 'When stock falls below threshold' },
              ] as { key: keyof typeof prefs.notifications; label: string; desc: string }[]).map(({ key, label, desc }, i) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none', background: 'var(--bg-elevated)' }}>
                  <div>
                    <p style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '2px' }}>{label}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{desc}</p>
                  </div>
                  {(['push', 'email'] as const).map(type => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'center' }}>
                      <Toggle
                        checked={prefs.notifications[key][type]}
                        onChange={v => {
                          const updated = { ...prefs.notifications, [key]: { ...prefs.notifications[key], [type]: v } };
                          setPrefs(p => ({ ...p, notifications: updated }));
                          savePrefs({ notifications: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '2.5rem', letterSpacing: '-0.03em' }}>Appearance & Vibe</h3>
            <div>
              <label style={labelStyle}>Color Theme</label>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {[
                  { value: 'light', icon: Sun, label: 'Light', desc: 'Clean & bright workspace' },
                  { value: 'dark', icon: Moon, label: 'Dark', desc: 'Easier on the eyes at night' },
                ].map(({ value, icon: Icon, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => {
                      const newTheme = value;
                      setPrefs(p => ({ ...p, theme: newTheme }));
                      savePrefs({ theme: newTheme });
                      localStorage.setItem('app_theme', newTheme);
                      if (newTheme === 'dark') {
                        document.documentElement.classList.add('dark');
                      } else {
                        document.documentElement.classList.remove('dark');
                      }
                    }}
                    style={{
                      flex: 1, padding: '2rem', borderRadius: '24px', cursor: 'pointer',
                      border: `2px solid ${prefs.theme === value ? 'var(--accent)' : 'var(--border)'}`,
                      background: prefs.theme === value ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1.25rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: prefs.theme === value ? 'var(--accent)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={26} color={prefs.theme === value ? 'white' : '#64748b'} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '4px' }}>{label}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {saveMsg && <p style={{ marginTop: '1.5rem', fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>{saveMsg}</p>}
          </div>
        );

      case 'checkout':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>POS Checkout Flow</h3>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '3rem', fontWeight: 600 }}>Control which payment methods are available at the terminal.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { key: 'enableCard', icon: CreditCard, label: 'Card Payment', desc: 'Visa, Mastercard, debit cards' },
                { key: 'enableCash', icon: Banknote, label: 'Cash', desc: 'Physical currency transactions' },
                { key: 'enableMpesa', icon: Phone, label: 'M-Pesa / Mobile Money', desc: 'Safaricom M-Pesa and mobile wallets' },
                { key: 'enableRoomCharge', icon: Building2, label: 'Room Charge', desc: 'Post charge to guest room account' },
              ].map(({ key, icon: Icon, label, desc }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', borderRadius: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={24} color="var(--accent)" />
                    </div>
                    <div>
                      <p style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '2px' }}>{label}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{desc}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={(prefs.checkout as any)[key]}
                    onChange={v => {
                      const updated = { ...prefs.checkout, [key]: v };
                      setPrefs(p => ({ ...p, checkout: updated }));
                      savePrefs({ checkout: updated });
                    }}
                  />
                </div>
              ))}
            </div>
            {saveMsg && <p style={{ marginTop: '1.5rem', fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>{saveMsg}</p>}
          </div>
        );

      case 'mpesa':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>M-Pesa Integration</h3>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2.5rem' }}>
              Configure your Safaricom Daraja API credentials to enable automated STK Push payments. Leave blank to use manual M-Pesa entry.
            </p>

            {/* Status Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.75rem', borderRadius: '20px', marginBottom: '2.5rem', background: mpesaConfigured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(148, 163, 184, 0.08)', border: `1px solid ${mpesaConfigured ? '#10b981' : 'var(--border)'}` }}>
              {mpesaConfigured
                ? <CheckCircle2 size={24} color="#10b981" />
                : <AlertCircle size={24} color="#94a3b8" />}
              <div>
                <p style={{ fontWeight: 800, color: mpesaConfigured ? '#10b981' : 'var(--text-secondary)' }}>
                  {mpesaConfigured ? 'STK Push Active' : 'Manual Mode (No Credentials Set)'}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {mpesaConfigured
                    ? `Customers on shortcode ${mpesaConfig.mpesaShortcode} will receive an automatic payment prompt.`
                    : 'Cashiers will manually record the M-Pesa confirmation code after customers pay via their phones.'}
                </p>
              </div>
              {mpesaConfigured && (
                <button onClick={async () => { await api.patch(`/tenants/${user?.tenantId}/settings/mpesa`, { mpesaConsumerKey: null, mpesaConsumerSecret: null, mpesaShortcode: null, mpesaPasskey: null, mpesaTillDisplay: null }); setMpesaConfigured(false); setMpesaConfig({ mpesaConsumerKey: '', mpesaConsumerSecret: '', mpesaShortcode: '', mpesaPasskey: '', mpesaTillDisplay: '' }); }}
                  style={{ marginLeft: 'auto', background: '#fff1f2', color: '#f43f5e', border: 'none', borderRadius: '10px', padding: '8px 14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XIcon size={14} /> Disconnect
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Consumer Key</label>
                  <input type="password" className="form-input" style={{ height: '52px', borderRadius: '14px', fontWeight: 700, background: 'var(--bg-deep)', fontFamily: 'monospace' }} placeholder="Paste from Daraja portal" value={mpesaConfig.mpesaConsumerKey} onChange={e => setMpesaConfig(p => ({ ...p, mpesaConsumerKey: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Consumer Secret</label>
                  <input type="password" className="form-input" style={{ height: '52px', borderRadius: '14px', fontWeight: 700, background: 'var(--bg-deep)', fontFamily: 'monospace' }} placeholder="Paste from Daraja portal" value={mpesaConfig.mpesaConsumerSecret} onChange={e => setMpesaConfig(p => ({ ...p, mpesaConsumerSecret: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Shortcode (Paybill/Till)</label>
                  <input type="text" className="form-input" style={{ height: '52px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)' }} placeholder="e.g. 600000" value={mpesaConfig.mpesaShortcode} onChange={e => setMpesaConfig(p => ({ ...p, mpesaShortcode: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Customer-Facing Till Display</label>
                  <input type="text" className="form-input" style={{ height: '52px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)' }} placeholder="e.g. 522522 or same as shortcode" value={mpesaConfig.mpesaTillDisplay} onChange={e => setMpesaConfig(p => ({ ...p, mpesaTillDisplay: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Lipa na M-Pesa Online Passkey</label>
                <input type="password" className="form-input" style={{ height: '52px', borderRadius: '14px', fontWeight: 700, background: 'var(--bg-deep)', fontFamily: 'monospace' }} placeholder="From Safaricom Business portal" value={mpesaConfig.mpesaPasskey} onChange={e => setMpesaConfig(p => ({ ...p, mpesaPasskey: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Credentials are stored encrypted. Keys are never returned after saving.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {mpesaSaveMsg && <span style={{ fontWeight: 800, color: mpesaSaveMsg.includes('✓') ? '#10b981' : '#f43f5e' }}>{mpesaSaveMsg}</span>}
                <button
                  className="btn btn-primary" style={{ height: '52px', minWidth: '180px', borderRadius: '14px', fontWeight: 800 }}
                  disabled={isSavingMpesa}
                  onClick={async () => {
                    setIsSavingMpesa(true); setMpesaSaveMsg('');
                    try {
                      const res = await api.patch(`/tenants/${user?.tenantId}/settings/mpesa`, mpesaConfig);
                      setMpesaConfigured(res.data.isConfigured);
                      setMpesaSaveMsg('✓ Saved!');
                      // Clear secrets from state — they're saved in DB now
                      setMpesaConfig(p => ({ ...p, mpesaConsumerKey: '', mpesaConsumerSecret: '', mpesaPasskey: '' }));
                    } catch { setMpesaSaveMsg('Save failed'); }
                    finally { setIsSavingMpesa(false); setTimeout(() => setMpesaSaveMsg(''), 3000); }
                  }}
                >
                  {isSavingMpesa ? <Loader2 size={20} className="animate-spin" /> : 'Save Credentials'}
                </button>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '2.5rem', letterSpacing: '-0.03em' }}>Security & Vault</h3>
            <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '20px', padding: '1.5rem 2rem', display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: '3rem' }}>
              <Shield size={28} color="#f97316" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 900, fontSize: '1.05rem', color: '#9a3412' }}>Account Security Notice</p>
                <p style={{ fontSize: '0.9rem', color: '#c2410c', fontWeight: 600 }}>Review active sessions and ensure your account is only accessed from trusted devices.</p>
              </div>
            </div>
            <p style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '1.5rem' }}>Active Sessions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { device: 'This Browser', loc: 'Current session', color: '#10b981', icon: Monitor, isActive: true },
                { device: 'Mobile Browser', loc: 'Last seen 2 hours ago', color: '#94a3b8', icon: Smartphone, isActive: false },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={24} color="#64748b" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: '1rem' }}>{s.device}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 800, color: s.color }}>{s.loc}</p>
                  </div>
                  {!s.isActive && (
                    <button style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f43f5e', background: '#fff1f2', border: 'none', borderRadius: '10px', padding: '6px 16px', cursor: 'pointer' }}>
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '1.5rem' }}>
              Signed in as <b>{user?.email}</b> · Role: <b style={{ textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</b>
            </p>
          </div>
        );

      case 'language':
        return (
          <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '2.5rem', letterSpacing: '-0.03em' }}>Region & Language</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <label style={labelStyle}>Language</label>
                <select
                  className="form-input"
                  style={{ height: '56px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)', cursor: 'pointer' }}
                  value={prefs.language}
                  onChange={e => setPrefs(p => ({ ...p, language: e.target.value }))}
                >
                  {['English', 'Swahili', 'French', 'Arabic'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Timezone</label>
                <select
                  className="form-input"
                  style={{ height: '56px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)', cursor: 'pointer' }}
                  value={prefs.timezone}
                  onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
                >
                  {['Africa/Nairobi', 'UTC', 'Africa/Lagos', 'Africa/Cairo', 'Europe/London', 'America/New_York'].map(tz => <option key={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Default Currency Display</label>
                <select
                  className="form-input"
                  style={{ height: '56px', borderRadius: '14px', fontWeight: 800, background: 'var(--bg-deep)', cursor: 'pointer' }}
                  value={prefs.currency}
                  onChange={e => setPrefs(p => ({ ...p, currency: e.target.value }))}
                >
                  {['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX', 'ZAR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1.5rem', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
              {saveMsg && <span style={{ fontSize: '0.95rem', fontWeight: 800, color: saveMsg === 'Saved!' ? '#10b981' : '#f43f5e' }}>{saveMsg}</span>}
              <button onClick={() => savePrefs({ language: prefs.language, timezone: prefs.timezone, currency: prefs.currency })} className="btn btn-primary" style={{ height: '56px', minWidth: '200px', borderRadius: '16px', fontSize: '1rem', fontWeight: 900 }}>
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>
          <button onClick={() => window.history.back()} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={16} />
          </button>
          <span>Settings</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 900 }}>{SECTIONS.find(s => s.id === activeSection)?.label}</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em' }}>Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '3rem', alignItems: 'flex-start' }}>
        {/* Sidebar Nav */}
        <div style={{ padding: '0.75rem', borderRadius: '28px', background: 'var(--bg-deep)', border: '1px solid var(--border)', position: 'sticky', top: '1.5rem' }}>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                width: '100%', padding: '1rem 1.25rem', borderRadius: '18px',
                border: 'none', cursor: 'pointer', marginBottom: '4px',
                background: activeSection === id ? 'var(--accent)' : 'transparent',
                color: activeSection === id ? 'white' : '#64748b',
                fontWeight: 800, fontSize: '0.95rem',
                transition: 'all 0.25s ease',
              }}
            >
              <Icon size={20} color={activeSection === id ? 'white' : '#94a3b8'} />
              {label}
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '36px', padding: '3.5rem', minHeight: '650px', boxShadow: '0 20px 60px rgba(0,0,0,0.03)' }}>
          {renderSection()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
