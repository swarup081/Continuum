import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../services/auth';
import { Hexagon, LogOut } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo"><Hexagon size={24} strokeWidth={2.5} /></span>
        <span className="navbar-title">Continuum</span>
      </div>
      <div className="navbar-right">
        {user && (
          <span className="navbar-user">{user.email || user.name || 'User'}</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </nav>
  );
}
