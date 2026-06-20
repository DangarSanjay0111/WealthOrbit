import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Orbit, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

export default function Register() {
  const { register } = useAuth();
  const { error: showError, success } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', familyName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      success('Account created! Welcome to WealthOrbit.');
      navigate('/dashboard');
    } catch (err) {
      showError(err.response?.data?.message || 'Registration failed.');
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

      <div className="auth-card">
        <div className="auth-logo">
          <div className="sidebar-logo-icon" style={{ width: 48, height: 48 }}>
            <Orbit size={28} />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start tracking your family's wealth</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-row">
            <div className="input-group">
              <label className="input-label">First Name</label>
              <input
                type="text" className="input" placeholder="John"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Last Name</label>
              <input
                type="text" className="input" placeholder="Doe"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email" className="input" placeholder="you@example.com"
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
                className="input" placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required minLength={6}
              />
              <button type="button" className="input-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Family Name</label>
            <input
              type="text" className="input" placeholder="e.g. Patel Family"
              value={form.familyName}
              onChange={(e) => setForm({ ...form, familyName: e.target.value })}
              required
            />
            <span className="text-xs text-secondary">You'll be the head of this family</span>
          </div>

          <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
