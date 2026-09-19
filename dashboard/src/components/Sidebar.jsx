import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">📁</span>
          <span>Projects</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">👤</span>
          <span>Profile</span>
        </NavLink>
        <NavLink to="/privacy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">🔒</span>
          <span>Privacy</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-version">Continuum v1.0</span>
      </div>
    </aside>
  );
}
