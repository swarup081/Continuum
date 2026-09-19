import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import ContextEntry from '../components/ContextEntry';
import EntryEditorModal from '../components/EntryEditorModal';
import { useToast } from '../components/Toast';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();
  const [tab, setTab] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => {
    loadEntries();
    loadProjectInfo();
  }, [id]);

  async function loadProjectInfo() {
    try {
      const data = await api.getProjects();
      const project = (data.projects || []).find(p => p.project_id === id);
      if (project) setProjectName(project.name);
    } catch { /* ignore */ }
  }

  async function loadEntries() {
    setLoading(true);
    try {
      const data = await api.getEntries(id);
      setEntries(data.entries || []);
    } catch (err) {
      addToast('Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await api.searchContext(id, searchQuery.trim());
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        addToast('No results found', 'info');
      }
    } catch (err) {
      addToast('Search failed', 'error');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
            ← Back
          </button>
          <h1>{projectName || 'Project Details'}</h1>
        </div>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab ${tab === 'entries' ? 'active' : ''}`}
          onClick={() => setTab('entries')}
        >
          📄 Context Entries
        </button>
        <button
          className={`filter-tab ${tab === 'search' ? 'active' : ''}`}
          onClick={() => setTab('search')}
        >
          🔍 Search
        </button>
      </div>

      {tab === 'entries' && (
        <div className="entries-list">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading entries...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No context entries captured yet</p>
              <p className="empty-sub">Start browsing with the Continuum extension active to capture context</p>
            </div>
          ) : (
            entries.map(entry => (
              <ContextEntry key={entry.entry_id} entry={entry} onEdit={setEditingEntryId} />
            ))
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search your context memory... (e.g. 'phone battery comparison')"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="search-results">
              <h3 className="search-results-title">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </h3>
              {searchResults.map(result => (
                <ContextEntry key={result.entry_id} entry={result} showScore={true} onEdit={setEditingEntryId} />
              ))}
            </div>
          )}
        </div>
      )}

      {editingEntryId && (
        <EntryEditorModal 
          entryId={editingEntryId} 
          onClose={() => setEditingEntryId(null)} 
          onSave={() => { setEditingEntryId(null); loadEntries(); }}
        />
      )}
    </div>
  );
}