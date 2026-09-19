import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !email || !password) { setError('Please fill in all fields'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await api.register(email, password, name);
      navigate('/projects');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container fade-in">
        <div className="auth-logo">
          <div className="auth-logo-icon">C</div>
          <div className="auth-logo-title">Continuum</div>
          <div className="auth-logo-subtitle">Never re-explain yourself to an AI again</div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label className="input-label">Name</label>
            <input type="text" className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>

          <div className="input-group">
            <label className="input-label">Email</label>
            <input type="email" className="input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" className="input" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <a href="/login">Sign in</a>
        </div>
      </div>
    </div>
  );
}
