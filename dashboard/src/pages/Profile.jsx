import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../components/Toast';

export default function Profile() {
  const addToast = useToast();
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const data = await api.getProfile();
      setFacts(data.facts || []);
    } catch (err) {
      addToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updateFact(index, field, value) {
    const updated = [...facts];
    updated[index] = { ...updated[index], [field]: value };
    setFacts(updated);
  }

  function addFact() {
    if (facts.length >= 10) {
      addToast('Maximum 10 facts allowed', 'error');
      return;
    }
    setFacts([...facts, { key: '', value: '' }]);
  }

  function removeFact(index) {
    setFacts(facts.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateProfile(facts);
      addToast('Profile saved successfully');
    } catch (err) {
      addToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Universal Profile</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="info-banner">
        <span className="info-icon">ℹ️</span>
        <p>This profile is shared with LLMs to give them context about you. Add facts like your name, profession, and interests.</p>
      </div>

      <div className="facts-list">
        {facts.map((fact, index) => (
          <div key={index} className="fact-row">
            <input
              type="text"
              placeholder="Label (e.g. profession)"
              value={fact.key}
              onChange={e => updateFact(index, 'key', e.target.value)}
              className="fact-key"
            />
            <input
              type="text"
              placeholder="Value (e.g. CS Student)"
              value={fact.value}
              onChange={e => updateFact(index, 'value', e.target.value)}
              className="fact-value"
            />
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeFact(index)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn-outline" onClick={addFact}>
        + Add Fact
      </button>
    </div>
  );
}
