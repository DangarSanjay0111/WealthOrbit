import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, ArrowLeftRight, Upload,
  FileText, User, ChevronLeft, ChevronRight, Orbit, Users
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/family', icon: Users, label: 'Family' },
  { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/upload', icon: Upload, label: 'Upload Report' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Orbit size={24} />
          </div>
          {!collapsed && <span className="sidebar-logo-text">WealthOrbit</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {navItems.slice(0, 5).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'mobile-nav-active' : ''}`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
