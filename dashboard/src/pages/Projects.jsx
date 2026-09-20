import { useState, useEffect } from 'react';
import api from '../services/api';
import ProjectCard from '../components/ProjectCard';
import { useToast } from '../components/Toast';
import { Folder } from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const addToast = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      addToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createProject(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      addToast('Project created successfully');
      await loadProjects();
    } catch (err) {
      addToast('Failed to create project', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(projectId) {
    try {
      await api.updateProject(projectId, { status: 'archived' });
      addToast('Project archived');
      await loadProjects();
    } catch (err) {
      addToast('Failed to archive project', 'error');
    }
  }

  async function handleRestore(projectId) {
    try {
      await api.restoreProject(projectId);
      addToast('Project restored');
      await loadProjects();
    } catch (err) {
      addToast('Failed to restore project', 'error');
    }
  }

  async function handleDelete(projectId) {
    if (deleteConfirm !== projectId) {
      setDeleteConfirm(projectId);
      return;
    }
    try {
      await api.deleteProject(projectId);
      setDeleteConfirm(null);
      addToast('Project deleted');
      await loadProjects();
    } catch (err) {
      addToast('Failed to delete project', 'error');
    }
  }

  const filtered = projects.filter(p => {
    if (filter === 'active') return p.status === 'active';
    if (filter === 'archived') return p.status === 'archived';
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showCreate && (
        <form className="create-form" onSubmit={handleCreate}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Project name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active
        </button>
        <button
          className={`filter-tab ${filter === 'archived' ? 'active' : ''}`}
          onClick={() => setFilter('archived')}
        >
          Archived
        </button>
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading projects...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><Folder size={48} strokeWidth={1} /></span>
          <p>No {filter !== 'all' ? filter : ''} projects yet</p>
          {filter === 'active' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map(project => (
            <ProjectCard
              key={project.project_id}
              project={project}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Project?</h2>
            </div>
            <div className="modal-body">
              <p>This will permanently delete the project and all its context entries. This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
