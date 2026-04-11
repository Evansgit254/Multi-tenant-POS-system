import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Sparkles, Diamond, BarChart3, Users2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const CAROUSEL_SLIDES = [
  { 
    title: "Analyze real-time data with custom reporting", 
    subtitle: "The future of luxury hospitality management, unified in one platform.",
    icon: <Diamond size={120} color="white" strokeWidth={1} style={{ opacity: 0.9, filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} />
  },
  { 
    title: "Manage sales, inventory and other transactions", 
    subtitle: "Real-time synchronization across all your property points.",
    icon: <BarChart3 size={120} color="white" strokeWidth={1} style={{ opacity: 0.9, filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} />
  },
  { 
    title: "Streamline your team communication easily", 
    subtitle: "Empower your staff with intuitive digital tools.",
    icon: <Users2 size={120} color="white" strokeWidth={1} style={{ opacity: 0.9, filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} />
  }
];

type ViewState = 'login' | 'register' | 'forgot' | 'reset';

const Login: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') as ViewState;
  const tokenParam = searchParams.get('token');
  const view: ViewState = tokenParam ? 'reset' : (viewParam || 'login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(p => (p + 1) % CAROUSEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const switchView = (newView: ViewState) => {
    setSearchParams(newView === 'login' ? {} : { view: newView });
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (view === 'login') {
        const response = await api.post('/auth/login', { email, password });
        const { token, user, tenant } = response.data;
        login(token, user, tenant);
        navigate('/');
      } else if (view === 'register') {
        await api.post('/auth/register', { email, password, name, hotelName });
        setSuccessMsg('Account created! Please sign in with your new credentials.');
        setTimeout(() => switchView('login'), 2500);
      } else if (view === 'forgot') {
        const response = await api.post('/auth/forgot-password', { email });
        setSuccessMsg(response.data.message);
        setTimeout(() => switchView('login'), 4000);
      } else if (view === 'reset') {
        const response = await api.post('/auth/reset-password', { token: tokenParam, password });
        setSuccessMsg(response.data.message);
        setTimeout(() => switchView('login'), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || (view === 'register' ? 'Registration failed. Please try again.' : 'Authentication failed. Please check credentials.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-sidebar)', padding: '1rem'
    }}>
      <div className="login-card">
        
        {/* Left Pane: Brand & Illustration (Emerald) */}
        <div className="login-brand-pane" style={{
          flex: 1, background: '#cbd5e1', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '4rem', position: 'relative'
        }}>
          {/* Logo */}
          <div style={{ position: 'absolute', top: '3rem', left: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="white" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>ServePoint</span>
          </div>

          <div style={{ textAlign: 'center', maxWidth: '380px' }}>
            {/* Carousel Content */}
            <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'center', height: '160px', alignItems: 'center' }}>
               {CAROUSEL_SLIDES[activeSlide].icon}
            </div>
            
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1d23', lineHeight: 1.1, marginBottom: '1.25rem' }}>
              {CAROUSEL_SLIDES[activeSlide].title}
            </h2>
            <p style={{ color: '#4b5563', fontSize: '1rem', fontWeight: 500, opacity: 0.8 }}>
              {CAROUSEL_SLIDES[activeSlide].subtitle}
            </p>

            {/* Carousel Indicators */}
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginTop: '3rem' }}>
              {CAROUSEL_SLIDES.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: activeSlide === idx ? '32px' : '10px', height: '10px', borderRadius: '5px',
                    background: activeSlide === idx ? 'var(--accent)' : 'rgba(0,0,0,0.1)', transition: 'all 0.4s ease'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Pane: Form Area (White) */}
        <div className="login-form-pane" style={{ flex: 1, padding: '5rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          <div style={{ marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} /> Start Your Journey
            </p>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>
              {view === 'login' && 'Welcome Back!'}
              {view === 'register' && 'Create Account'}
              {view === 'forgot' && 'Reset Password'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>
              {view === 'login' && 'Please sign in to continue'}
              {view === 'register' && 'Join the premium hospitality network'}
            </p>
          </div>

          {error && <div style={{ padding: '1rem 1.25rem', background: '#fff1f2', color: '#be123c', borderRadius: '14px', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 700, border: '1px solid #ffe4e6' }}>{error}</div>}
          {successMsg && <div style={{ padding: '1rem 1.25rem', background: '#f0fdf4', color: '#15803d', borderRadius: '14px', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 700, border: '1px solid #dcfce7' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {view === 'register' && (
              <>
                <input type="text" required placeholder="Hotel / Business Name" value={hotelName} onChange={(e) => setHotelName(e.target.value)} className="form-input" style={{ background: 'var(--bg-deep)', border: 'none', height: '60px' }} />
                <input type="text" required placeholder="Your Full Name" value={name} onChange={(e) => setName(e.target.value)} className="form-input" style={{ background: 'var(--bg-deep)', border: 'none', height: '60px' }} />
              </>
            )}
            <input type="email" required placeholder="Sales ID number / Email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" style={{ background: 'var(--bg-deep)', border: 'none', height: '60px' }} />
            
            {view !== 'forgot' && (
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" style={{ background: 'var(--bg-deep)', border: 'none', height: '60px', paddingRight: '3.5rem' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ height: '64px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, marginTop: '1rem' }}>
              {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : (view === 'login' ? 'Sign in' : 'Continue')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button onClick={() => switchView(view === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
              {view === 'login' ? <>Don't have an account? <span style={{ color: 'var(--accent)', fontWeight: 800 }}>Go to Registration</span></> : 'Back to Login'}
            </button>
            {view === 'login' && (
              <button onClick={() => switchView('forgot')} style={{ display: 'block', margin: '1rem auto 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                Forgot password?
              </button>
            )}
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
              © 2026 Mumo Syntax & Capital
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
