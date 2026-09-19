import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Plus, Archive, ArchiveRestore, Trash2, FolderOpen, Folder } from 'lucide-react';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try {
      const data = await api.getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newName.trim()) return;
    try {
      const project = await api.createProject(newName.trim(), newDesc.trim());
      setProjects(prev => [project, ...prev]);
      setShowModal(false);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      alert('Failed to create project');
    }
  }

  async function archiveProject(e, project) {
    e.stopPropagation();
    try {
      await api.updateProject(project.project_id, { status: 'archived' });
      setProjects(prev => prev.map(p => p.project_id === project.project_id ? { ...p, status: 'archived' } : p));
    } catch (err) {
      alert('Failed to archive');
    }
  }

  async function restoreProject(e, project) {
    e.stopPropagation();
    try {
      await api.restoreProject(project.project_id);
      setProjects(prev => prev.map(p => p.project_id === project.project_id ? { ...p, status: 'active' } : p));
    } catch (err) {
      alert('Failed to restore');
    }
  }

  async function deleteProject(e, project) {
    e.stopPropagation();
    if (!confirm(`Permanently delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProject(project.project_id);
      setProjects(prev => prev.filter(p => p.project_id !== project.project_id));
    } catch (err) {
      alert('Failed to delete');
    }
  }

  const filtered = projects.filter(p => {
    if (filter === 'active') return p.status === 'active';
    if (filter === 'archived') return p.status === 'archived';
    return true;
  });

  const activeCount = projects.filter(p => p.status === 'active').length;
  const totalEntries = projects.reduce((sum, p) => sum + (p.context_count || 0), 0);

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage your context memory workspaces</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="page-body fade-in">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{activeCount}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalEntries}</div>
            <div className="stat-label">Context Entries</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Total Projects</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['all', 'active', 'archived'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="empty-state"><div className="empty-text">Loading projects...</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Folder size={48} strokeWidth={1} /></div>
            <div className="empty-title">No projects yet</div>
            <div className="empty-text">Create your first project to start capturing context across LLMs and websites.</div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create Project
            </button>
          </div>
        ) : (
          <div className="grid-2">
            {filtered.map(project => (
              <div
                key={project.project_id}
                className="card card-clickable"
                onClick={() => navigate(`/projects/${project.project_id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{project.name}</h3>
                    {project.description && (
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{project.description}</p>
                    )}
                  </div>
                  <span className={`badge ${project.status === 'active' ? 'badge-active' : 'badge-archived'}`}>
                    {project.status}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    <FolderOpen size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }}/>
                    {project.context_count || 0} items &bull; {formatDate(project.created_at)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {project.status === 'active' ? (
                      <button className="btn btn-sm btn-secondary" onClick={e => archiveProject(e, project)} title="Archive">
                        <Archive size={14} />
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-secondary" onClick={e => restoreProject(e, project)} title="Restore">
                        <ArchiveRestore size={14} />
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={e => deleteProject(e, project)} title="Delete permanently">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Create New Project</div>
            <div className="input-group">
              <label className="input-label">Project Name</label>
              <input
                className="input"
                placeholder="e.g., Buy Phone, Research Paper..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createProject()}
                autoFocus
              />
            </div>
            <div className="input-group" style={{ marginTop: '16px' }}>
              <label className="input-label">Description (optional)</label>
              <input
                className="input"
                placeholder="What's this project about?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createProject()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createProject}>Create Project</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
