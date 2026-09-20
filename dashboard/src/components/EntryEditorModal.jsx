import { useState, useEffect } from 'react';
import api from '../services/api';

export default function EntryEditorModal({ entryId, onClose, onSave }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadRaw() {
      try {
        const data = await api.getRawEntry(entryId);
        setContent(data.raw_content || '');
      } catch (err) {
        setError('Failed to load full text');
      } finally {
        setLoading(false);
      }
    }
    loadRaw();
  }, [entryId]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateEntry(entryId, content);
      onSave(); // trigger parent refresh
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: '80%', maxWidth: '800px', height: '80vh' }}>
        <div className="modal-header">
          <h2>Edit Context Entry</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading full text...</p>
            </div>
          ) : (
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ 
                flex: 1, 
                width: '100%',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '14px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                resize: 'none',
                outline: 'none'
              }}
            />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
