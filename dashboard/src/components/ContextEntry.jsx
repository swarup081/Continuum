const SOURCE_ICONS = {
  'ChatGPT': '🤖',
  'Gemini': '✨',
  'Claude': '🧠',
  'web_page': '🌐',
};

export default function ContextEntry({ entry, showScore = false, onEdit }) {
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const icon = SOURCE_ICONS[entry.source_name] || SOURCE_ICONS[entry.source_type] || '📄';

  return (
    <div className="context-entry">
      <div className="context-entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="context-entry-source">
          <span className="context-entry-icon">{icon}</span>
          <span className="context-entry-name">{entry.source_name}</span>
          {showScore && entry.relevance_score !== undefined && (
            <span className="badge badge-accent">
              {Math.round(entry.relevance_score * 100)}% match
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="context-entry-date">{formatDate(entry.captured_at)}</span>
          {onEdit && (
            <button 
              onClick={() => onEdit(entry.entry_id)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #3d3d5c' }}
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <p className="context-entry-summary">{entry.summary_text}</p>
      {entry.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="context-entry-url"
        >
          {entry.url.length > 60 ? entry.url.slice(0, 60) + '...' : entry.url}
        </a>
      )}
    </div>
  );
}
