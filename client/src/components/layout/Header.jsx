import { useState, useRef, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  Sun, Moon, User, Settings, LogOut, Orbit,
  LayoutDashboard, Briefcase, ArrowLeftRight, FileText, Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getInitials } from '../../utils/formatters';
import './Header.css';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/family', icon: Users, label: 'Family' },
  { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/reports', icon: FileText, label: 'Reports' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo" onClick={() => navigate('/dashboard')}>
          <Orbit size={30} className="text-primary" />
          <span className="font-bold text-2xl">WealthOrbit</span>
        </div>
      </div>

      <div className="header-center">
        <nav className="header-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="header-right">
        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="dropdown" ref={userMenuRef}>
          <button
            className="header-avatar"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" />
            ) : (
              <span>{getInitials(user?.firstName, user?.lastName)}</span>
            )}
          </button>

          {showUserMenu && (
            <div className="dropdown-menu">
              <div className="user-menu-header">
                <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-secondary">{user?.email}</p>
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={() => { navigate('/profile'); setShowUserMenu(false); }}>
                <User size={16} /> Profile
              </button>
              <button className="dropdown-item" onClick={() => { navigate('/settings'); setShowUserMenu(false); }}>
                <Settings size={16} /> Settings
              </button>
              <div className="dropdown-divider" />
              <button className="dropdown-item text-danger" onClick={logout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
