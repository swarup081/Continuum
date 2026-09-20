import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Archive, Trash2, RotateCcw } from 'lucide-react';

export default function ProjectCard({ project, onArchive, onRestore, onDelete }) {
  const navigate = useNavigate();
  const isArchived = project.status === 'archived';

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="project-card" onClick={() => navigate(`/projects/${project.project_id}`)}>
      <div className="project-card-header">
        <h3 className="project-card-name">{project.name}</h3>
        <span className={`badge ${isArchived ? 'badge-gray' : 'badge-green'}`}>
          {isArchived ? 'Archived' : 'Active'}
        </span>
      </div>
      {project.description && (
        <p className="project-card-desc">{project.description}</p>
      )}
      <div className="project-card-meta">
        <span className="meta-item"><FileText size={14} /> {project.context_count || 0} entries</span>
        <span className="meta-item"><Calendar size={14} /> {formatDate(project.created_at)}</span>
      </div>
      <div className="project-card-actions" onClick={e => e.stopPropagation()}>
        {isArchived ? (
          <button className="btn btn-sm btn-outline" onClick={() => onRestore(project.project_id)}>
            <RotateCcw size={14} /> Restore
          </button>
        ) : (
          <button className="btn btn-sm btn-outline" onClick={() => onArchive(project.project_id)}>
            <Archive size={14} /> Archive
          </button>
        )}
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(project.project_id)}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}
