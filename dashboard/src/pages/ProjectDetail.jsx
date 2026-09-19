import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Bot, Sparkles, Cpu, Globe, Search, ArrowLeft, Inbox } from 'lucide-react';

const SOURCE_ICONS = {
  ChatGPT: <Bot size={20} />,
  Gemini: <Sparkles size={20} />,
  Claude: <Cpu size={20} />,
  default: <Globe size={20} />,
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('entries');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [project, setProject] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [entriesData, projectsData] = await Promise.all([
        api.getEntries(id),
        api.getProjects(),
      ]);
      setEntries(entriesData.entries || []);
      const proj = projectsData.projects?.find(p => p.project_id === id);
      setProject(proj);
    } catch (err) {
      console.error('Failed to load:', err);
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
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }

  function getIcon(sourceName) {
    return SOURCE_ICONS[sourceName] || SOURCE_ICONS.default;
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function renderEntryList(items) {
    if (items.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon"><Inbox size={48} strokeWidth={1} /></div>
          <div className="empty-title">No context captured yet</div>
          <div className="empty-text">Browse websites or chat with LLMs while this project is active to start capturing context.</div>
        </div>
      );
    }

    return items.map(entry => (
      <div className="entry-item" key={entry.entry_id}>
        <div className="entry-icon">{getIcon(entry.source_name)}</div>
        <div className="entry-body">
          <div className="entry-source">
            <span className="badge badge-source">{entry.source_name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {entry.source_type === 'llm_chat' ? 'LLM Chat' : 'Webpage'}
            </span>
            {entry.relevance_score && (
              <span style={{ color: 'var(--success)', fontSize: '12px', marginLeft: 'auto', fontWeight: 600 }}>
                {(entry.relevance_score * 100).toFixed(0)}% match
              </span>
            )}
          </div>
          <div className="entry-summary">{entry.summary_text}</div>
          {entry.url && (
            <a href={entry.url} target="_blank" rel="noopener noreferrer" className="entry-url">
              {entry.url}
            </a>
          )}
        </div>
        <div className="entry-time">{timeAgo(entry.captured_at)}</div>
      </div>
    ));
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-icon" onClick={() => navigate('/projects')} title="Back to projects">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{project?.name || 'Project'}</h1>
            <p className="page-subtitle">
              {project?.description || ''} &bull; {entries.length} context entries
            </p>
          </div>
          {project && (
            <span className={`badge ${project.status === 'active' ? 'badge-active' : 'badge-archived'}`} style={{ marginLeft: '8px' }}>
              {project.status}
            </span>
          )}
        </div>
      </div>

      <div className="page-body fade-in">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button className={`btn btn-sm ${tab === 'entries' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('entries')}>
            📋 Context Entries
          </button>
          <button className={`btn btn-sm ${tab === 'search' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('search')}>
            <Search size={14} style={{ marginRight: '4px' }}/> Search
          </button>
        </div>

        {tab === 'entries' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '24px' }}>
              {loading ? (
                <div className="empty-state"><div className="empty-text">Loading entries...</div></div>
              ) : (
                renderEntryList(entries)
              )}
            </div>
          </div>
        )}

        {tab === 'search' && (
          <>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <input
                className="input"
                placeholder="Search your project context... (e.g., 'camera comparison')"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={searching}>
                {searching ? '...' : <><Search size={16} /> Search</>}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: 500 }}>
                  {searchResults.length} results for "{searchQuery}"
                </div>
                {renderEntryList(searchResults)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
