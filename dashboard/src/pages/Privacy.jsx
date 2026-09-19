import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, Globe, Key, CheckCircle2, X } from 'lucide-react';

export default function Privacy() {
  const [domains, setDomains] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [captureEnabled, setCaptureEnabled] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadPrivacy(); }, []);

  async function loadPrivacy() {
    try {
      const data = await api.getPrivacy();
      setDomains(data.blocked_domains || []);
      setKeywords(data.blocked_keywords || []);
      setCaptureEnabled(data.capture_enabled !== false);
    } catch (err) {
      console.error('Failed to load privacy settings:', err);
    } finally {
      setLoading(false);
    }
  }

  function addDomain() {
    const d = newDomain.trim().toLowerCase();
    if (d && !domains.includes(d)) {
      setDomains(prev => [...prev, d]);
      setNewDomain('');
      setSaved(false);
    }
  }

  function removeDomain(domain) {
    setDomains(prev => prev.filter(d => d !== domain));
    setSaved(false);
  }

  function addKeyword() {
    const k = newKeyword.trim();
    if (k && !keywords.includes(k)) {
      setKeywords(prev => [...prev, k]);
      setNewKeyword('');
      setSaved(false);
    }
  }

  function removeKeyword(keyword) {
    setKeywords(prev => prev.filter(k => k !== keyword));
    setSaved(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.updatePrivacy({
        blocked_domains: domains,
        blocked_keywords: keywords,
        capture_enabled: captureEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Privacy Settings</h1>
        </div>
        <div className="page-body"><div className="empty-state"><div className="empty-text">Loading...</div></div></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Privacy Settings</h1>
        <p className="page-subtitle">Control what Continuum captures and what it ignores</p>
      </div>

      <div className="page-body fade-in" style={{ maxWidth: '720px' }}>
        {/* Master Toggle */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} color="var(--accent)" /> Context Capture
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {captureEnabled ? 'Continuum is actively capturing context from your browsing.' : 'Capture is paused — nothing will be recorded.'}
              </p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={captureEnabled} onChange={e => { setCaptureEnabled(e.target.checked); setSaved(false); }} />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Blocked Domains */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Globe size={18} color="var(--text-muted)" /> Blocked Domains
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Continuum will never capture content from these websites.
          </p>

          <div className="tag-list" style={{ marginBottom: '16px' }}>
            {domains.map(domain => (
              <div className="tag" key={domain}>
                {domain}
                <span className="tag-remove" onClick={() => removeDomain(domain)}><X size={14} /></span>
              </div>
            ))}
            {domains.length === 0 && (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No blocked domains</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              className="input"
              placeholder="e.g., bank.example.com"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDomain()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addDomain}>Add Domain</button>
          </div>
        </div>

        {/* Blocked Keywords */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--text-muted)" /> Blocked Keywords
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Any captured text containing these words will have them redacted before sending to the server.
          </p>

          <div className="tag-list" style={{ marginBottom: '16px' }}>
            {keywords.map(keyword => (
              <div className="tag" key={keyword}>
                {keyword}
                <span className="tag-remove" onClick={() => removeKeyword(keyword)}><X size={14} /></span>
              </div>
            ))}
            {keywords.length === 0 && (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No blocked keywords</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              className="input"
              placeholder="e.g., secret_api_key"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addKeyword}>Add Keyword</button>
          </div>
        </div>

        {/* Privacy info */}
        <div className="card" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>How Continuum protects your data</h3>
          <ul style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '24px' }}>
            <li><strong>Client-side filter:</strong> OTPs, card numbers, and passwords are stripped before leaving your browser.</li>
            <li><strong>Server-side filter:</strong> Amazon Comprehend PII detection runs as a second pass on AWS.</li>
            <li><strong>Blocked domains:</strong> Banking, messaging, and mail sites are blocked by default.</li>
            <li><strong>Visible indicator:</strong> The extension badge always shows when capture is active.</li>
            <li><strong>Project archive:</strong> Archived projects retain data but are excluded from active context injection.</li>
          </ul>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span style={{ color: 'var(--success)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={18} /> Settings saved
            </span>
          )}
        </div>
      </div>
    </>
  );
}
