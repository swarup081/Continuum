import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import { X } from 'lucide-react';

export default function Privacy() {
  const addToast = useToast();
  const [domains, setDomains] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [captureEnabled, setCaptureEnabled] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrivacy();
  }, []);

  async function loadPrivacy() {
    setLoading(true);
    try {
      const data = await api.getPrivacy();
      setDomains(data.blocked_domains || []);
      setKeywords(data.blocked_keywords || []);
      setCaptureEnabled(data.capture_enabled !== false);
    } catch (err) {
      addToast('Failed to load privacy settings', 'error');
    } finally {
      setLoading(false);
    }
  }

  function addDomain() {
    const d = newDomain.trim().toLowerCase();
    if (!d) return;
    if (domains.includes(d)) {
      addToast('Domain already blocked', 'error');
      return;
    }
    setDomains([...domains, d]);
    setNewDomain('');
  }

  function removeDomain(domain) {
    setDomains(domains.filter(d => d !== domain));
  }

  function addKeyword() {
    const k = newKeyword.trim();
    if (!k) return;
    if (keywords.includes(k)) {
      addToast('Keyword already blocked', 'error');
      return;
    }
    setKeywords([...keywords, k]);
    setNewKeyword('');
  }

  function removeKeyword(keyword) {
    setKeywords(keywords.filter(k => k !== keyword));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updatePrivacy({
        blocked_domains: domains,
        blocked_keywords: keywords,
        capture_enabled: captureEnabled,
      });
      addToast('Privacy settings saved');
    } catch (err) {
      addToast('Failed to save privacy settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading privacy settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Privacy Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Master Toggle */}
      <div className="setting-card">
        <div className="setting-header">
          <div>
            <h3>Context Capture</h3>
            <p className="setting-desc">Master toggle for the browser extension's context capture</p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={captureEnabled}
              onChange={e => setCaptureEnabled(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Blocked Domains */}
      <div className="setting-card">
        <h3>Blocked Domains</h3>
        <p className="setting-desc">Continuum will never capture content from these websites</p>
        <div className="tag-list">
          {domains.map(domain => (
            <span key={domain} className="tag">
              {domain}
              <button className="tag-remove" onClick={() => removeDomain(domain)}><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="add-row">
          <input
            type="text"
            placeholder="e.g. web.whatsapp.com"
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDomain())}
          />
          <button className="btn btn-outline btn-sm" onClick={addDomain}>Add</button>
        </div>
      </div>

      {/* Blocked Keywords */}
      <div className="setting-card">
        <h3>Blocked Keywords</h3>
        <p className="setting-desc">Any captured text containing these words will be redacted locally before sending</p>
        <div className="tag-list">
          {keywords.map(keyword => (
            <span key={keyword} className="tag tag-red">
              {keyword}
              <button className="tag-remove" onClick={() => removeKeyword(keyword)}><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="add-row">
          <input
            type="text"
            placeholder="e.g. password"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
          />
          <button className="btn btn-outline btn-sm" onClick={addKeyword}>Add</button>
        </div>
      </div>
    </div>
  );
}
