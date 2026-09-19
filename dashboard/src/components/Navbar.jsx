import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../services/auth';

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
        <span className="navbar-logo">◉</span>
        <span className="navbar-title">Continuum</span>
      </div>
      <div className="navbar-right">
        {user && (
          <span className="navbar-user">{user.email || user.name || 'User'}</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
