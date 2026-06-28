import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Orbit, Eye, EyeOff, TrendingUp, Target, PieChart, ShieldCheck,
} from 'lucide-react';
import './Auth.css';

const FEATURES = [
  { icon: TrendingUp, title: 'Track Wealth', desc: 'Monitor every asset in one place' },
  { icon: Target, title: 'Set Goals', desc: 'Plan and reach financial milestones' },
  { icon: PieChart, title: 'Portfolio Analysis', desc: 'Deep insights into your holdings' },
  { icon: ShieldCheck, title: 'Secure Storage', desc: 'Bank-grade encryption, always' },
];

const STATS = [
  { value: '6+', label: 'Asset Types' },
  { value: '100%', label: 'Secure' },
  { value: 'Free', label: 'To Start' },
];

export default function Login() {
  const { login } = useAuth();
  const { error: showError } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      showError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-orbs">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-shell">
        {/* ===== Left: branding / marketing ===== */}
        <aside className="auth-brand">
          <div className="auth-brand-head">
            <div className="sidebar-logo-icon" style={{ width: 44, height: 44 }}>
              <Orbit size={26} />
            </div>
            <span className="auth-brand-name">WealthOrbit</span>
          </div>

          <h2 className="auth-brand-headline">
            Take Control of Your <span className="auth-brand-accent">Financial Future</span>
          </h2>
          <p className="auth-brand-sub">
            Track your wealth, set goals, and grow your portfolio — all in one secure dashboard.
          </p>

          <div className="auth-feature-grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="auth-feature">
                <div className="auth-feature-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="auth-feature-title">{title}</p>
                  <p className="auth-feature-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-stats">
            {STATS.map(({ value, label }) => (
              <div key={label} className="auth-stat">
                <p className="auth-stat-value">{value}</p>
                <p className="auth-stat-label">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* ===== Right: login form ===== */}
        <div className="auth-card">
          <div className="auth-card-head">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to manage your finances and track your wealth</p>
          </div>

          <div className="auth-tabs">
            <span className="auth-tab active">Sign In</span>
            <Link to="/register" className="auth-tab">Sign Up</Link>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="input-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
