import { Bot, Sparkles, BrainCircuit, Globe, FileText, Link, Edit2 } from 'lucide-react';

const SOURCE_ICONS = {
  'ChatGPT': <Bot size={16} />,
  'Gemini': <Sparkles size={16} />,
  'Claude': <BrainCircuit size={16} />,
  'web_page': <Globe size={16} />,
};

export default function ContextEntry({ entry, showScore = false, onEdit }) {
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const icon = SOURCE_ICONS[entry.source_name] || SOURCE_ICONS[entry.source_type] || <FileText size={16} />;

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
              className="btn btn-outline btn-sm"
            >
              <Edit2 size={12} /> Edit
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
          <Link size={14} />
          {entry.url.length > 60 ? entry.url.slice(0, 60) + '...' : entry.url}
        </a>
      )}
    </div>
  );
}
