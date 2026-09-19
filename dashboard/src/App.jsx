import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Profile from './pages/Profile';
import Privacy from './pages/Privacy';
import { FolderGit2, UserCircle, Shield, LogOut } from 'lucide-react';

function ProtectedRoute({ children }) {
  if (!api.isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  const user = api.getUser();
  const path = window.location.pathname;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">C</div>
            <span className="sidebar-logo-text">Continuum</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Overview</div>
          <a href="/projects" className={`nav-link ${path.startsWith('/projects') ? 'active' : ''}`}>
            <span className="nav-link-icon"><FolderGit2 size={18} /></span>
            Projects
          </a>

          <div className="nav-section-label" style={{ marginTop: '24px' }}>Settings</div>
          <a href="/profile" className={`nav-link ${path === '/profile' ? 'active' : ''}`}>
            <span className="nav-link-icon"><UserCircle size={18} /></span>
            Profile
          </a>
          <a href="/privacy" className={`nav-link ${path === '/privacy' ? 'active' : ''}`}>
            <span className="nav-link-icon"><Shield size={18} /></span>
            Privacy
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{(user?.name?.[0] || 'U').toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-email">{user?.email || ''}</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
            onClick={() => { api.logout(); window.location.href = '/login'; }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><Layout><ProjectDetail /></Layout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
        <Route path="/privacy" element={<ProtectedRoute><Layout><Privacy /></Layout></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
