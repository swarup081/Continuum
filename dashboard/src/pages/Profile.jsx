import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Briefcase, Star, Info, CheckCircle2 } from 'lucide-react';

export default function Profile() {
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await api.getProfile();
      setFacts(data.facts || []);
      // Ensure minimum fields exist
      const keys = (data.facts || []).map(f => f.key);
      const defaults = [
        { key: 'name', value: '' },
        { key: 'profession', value: '' },
        { key: 'interest_1', value: '' },
        { key: 'interest_2', value: '' },
      ];
      const merged = [...(data.facts || [])];
      for (const d of defaults) {
        if (!keys.includes(d.key)) merged.push(d);
      }
      setFacts(merged);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  function updateFact(key, value) {
    setFacts(prev => prev.map(f => f.key === key ? { ...f, value } : f));
    setSaved(false);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const filtered = facts.filter(f => f.value.trim() !== '');
      await api.updateProfile(filtered);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    name: { label: 'Your Name', placeholder: 'e.g., Swarup', icon: <User size={16} /> },
    profession: { label: 'Profession / Role', placeholder: 'e.g., CS Student, 3rd Year', icon: <Briefcase size={16} /> },
    interest_1: { label: 'Interest #1', placeholder: 'e.g., Mobile technology', icon: <Star size={16} /> },
    interest_2: { label: 'Interest #2', placeholder: 'e.g., Web development', icon: <Star size={16} /> },
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Universal Profile</h1>
        <p className="page-subtitle">This information is shared with LLMs to give them context about you</p>
      </div>

      <div className="page-body fade-in">
        <div className="card" style={{ maxWidth: '640px' }}>
          {loading ? (
            <div className="empty-state"><div className="empty-text">Loading profile...</div></div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {facts.map(fact => {
                  const meta = labels[fact.key] || { label: fact.key, placeholder: '', icon: <Star size={16} /> };
                  return (
                    <div className="input-group" key={fact.key}>
                      <label className="input-label">
                        <span style={{ color: 'var(--text-muted)' }}>{meta.icon}</span>
                        {meta.label}
                      </label>
                      <input
                        className="input"
                        placeholder={meta.placeholder}
                        value={fact.value}
                        onChange={e => updateFact(fact.key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
                <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
                {saved && (
                  <span style={{ color: 'var(--success)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={18} /> Profile saved
                  </span>
                )}
              </div>

              <div style={{ marginTop: '32px', padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', gap: '12px' }}>
                <Info size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>How this works:</strong> When you start a new chat with any LLM, Continuum includes this profile in the context primer. The LLM will know who you are without you having to explain.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
