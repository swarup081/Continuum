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
      <div className="modal" style={{ width: '80%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h2>Edit Context Entry</h2>
        
        {error && <div className="toast toast-error">{error}</div>}
        
        {loading ? (
          <div className="loading" style={{ margin: 'auto' }}>Loading full text...</div>
        ) : (
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ 
              flex: 1, 
              width: '100%', 
              margin: '16px 0', 
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '14px',
              backgroundColor: '#1e1e2f',
              color: '#fff',
              border: '1px solid #3d3d5c',
              borderRadius: '8px',
              resize: 'none'
            }}
          />
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'auto' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
