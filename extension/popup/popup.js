// Continuum — Popup Script
// Project management UI: create, list, switch, archive, restore

import { ContinuumAPI } from '../utils/api-client.js';

// ─── State ──────────────────────────────────────────────────────────
let activeProject = null;
let captureEnabled = true;
let projects = [];

// ─── DOM Elements ───────────────────────────────────────────────────
const els = {
  captureToggle: document.getElementById('captureToggle'),
  captureIcon: document.getElementById('captureIcon'),
  activeProjectBanner: document.getElementById('activeProjectBanner'),
  activeProjectName: document.getElementById('activeProjectName'),
  activeProjectCount: document.getElementById('activeProjectCount'),
  newProjectName: document.getElementById('newProjectName'),
  createProjectBtn: document.getElementById('createProjectBtn'),
  projectList: document.getElementById('projectList'),
  statusText: document.getElementById('statusText'),
  authSection: document.getElementById('authSection'),
  loginBtn: document.getElementById('loginBtn'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
};

// ─── Initialize ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  await loadProjects();
  setupEventListeners();
  updateUI();
});

async function loadState() {
  const data = await chrome.storage.local.get(['activeProject', 'captureEnabled']);
  activeProject = data.activeProject || null;
  captureEnabled = data.captureEnabled !== false;
}

async function loadProjects() {
  try {
    const data = await ContinuumAPI.getProjects();
    projects = data.projects || [];
    renderProjectList();
  } catch (err) {
    console.error('Failed to load projects:', err);
    els.projectList.innerHTML = '<div class="loading">Failed to load projects</div>';
  }
}

// ─── Event Listeners ────────────────────────────────────────────────
function setupEventListeners() {
  // Create project
  els.createProjectBtn.addEventListener('click', createProject);
  els.newProjectName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createProject();
  });

  // Toggle capture
  els.captureToggle.addEventListener('click', toggleCapture);

  // Login
  els.loginBtn?.addEventListener('click', handleLogin);
}

// ─── Create Project ─────────────────────────────────────────────────
async function createProject() {
  const name = els.newProjectName.value.trim();
  if (!name) {
    setStatus('Enter a project name');
    return;
  }

  try {
    els.createProjectBtn.disabled = true;
    els.createProjectBtn.textContent = '...';

    const project = await ContinuumAPI.createProject(name);
    projects.unshift(project);

    // Auto-switch to new project
    await switchProject(project);

    els.newProjectName.value = '';
    renderProjectList();
    setStatus(`Created "${name}"`);
  } catch (err) {
    setStatus('Failed to create project');
    console.error(err);
  } finally {
    els.createProjectBtn.disabled = false;
    els.createProjectBtn.textContent = 'Create';
  }
}

// ─── Switch Project ─────────────────────────────────────────────────
async function switchProject(project) {
  activeProject = {
    project_id: project.project_id,
    name: project.name,
    context_count: project.context_count || 0,
  };

  await chrome.runtime.sendMessage({
    type: 'SET_ACTIVE_PROJECT',
    project: activeProject,
  });

  updateUI();
  renderProjectList();
  setStatus(`Switched to "${project.name}"`);
}

// ─── Archive/Restore/Delete ─────────────────────────────────────────
async function archiveProject(project) {
  try {
    // Save current tabs before archiving
    await chrome.runtime.sendMessage({
      type: 'SAVE_TABS',
      projectId: project.project_id,
    });

    await ContinuumAPI.updateProject(project.project_id, { status: 'archived' });
    project.status = 'archived';

    // If this was the active project, clear it
    if (activeProject?.project_id === project.project_id) {
      activeProject = null;
      await chrome.runtime.sendMessage({ type: 'SET_ACTIVE_PROJECT', project: null });
    }

    renderProjectList();
    updateUI();
    setStatus(`Archived "${project.name}"`);
  } catch (err) {
    setStatus('Failed to archive');
    console.error(err);
  }
}

async function restoreProject(project) {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'RESTORE_TABS',
      projectId: project.project_id,
    });

    await ContinuumAPI.updateProject(project.project_id, { status: 'active' });
    project.status = 'active';

    // Auto-switch to restored project
    await switchProject(project);

    renderProjectList();
    setStatus(`Restored "${project.name}" — opened ${result.opened || 0} tabs`);
  } catch (err) {
    setStatus('Failed to restore');
    console.error(err);
  }
}

async function deleteProject(project) {
  if (!confirm(`Permanently delete "${project.name}" and all its context? This cannot be undone.`)) {
    return;
  }

  try {
    await ContinuumAPI.deleteProject(project.project_id);
    projects = projects.filter(p => p.project_id !== project.project_id);

    if (activeProject?.project_id === project.project_id) {
      activeProject = null;
      await chrome.runtime.sendMessage({ type: 'SET_ACTIVE_PROJECT', project: null });
    }

    renderProjectList();
    updateUI();
    setStatus(`Deleted "${project.name}"`);
  } catch (err) {
    setStatus('Failed to delete');
    console.error(err);
  }
}

// ─── Toggle Capture ─────────────────────────────────────────────────
async function toggleCapture() {
  captureEnabled = !captureEnabled;

  await chrome.runtime.sendMessage({
    type: 'TOGGLE_CAPTURE',
    enabled: captureEnabled,
  });

  updateUI();
  setStatus(captureEnabled ? 'Capture enabled' : 'Capture paused');
}

// ─── Render ─────────────────────────────────────────────────────────
function renderProjectList() {
  if (projects.length === 0) {
    els.projectList.innerHTML = '<div class="loading">No projects yet. Create one above!</div>';
    return;
  }

  // Sort: active first, then by created_at desc
  const sorted = [...projects].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  els.projectList.innerHTML = sorted.map(p => {
    const isActive = activeProject?.project_id === p.project_id;
    const isArchived = p.status === 'archived';

    return `
      <div class="project-item ${isActive ? 'active' : ''}" data-id="${p.project_id}">
        <div class="project-info" data-action="switch" data-id="${p.project_id}">
          <div class="project-name">${escapeHtml(p.name)}</div>
          <div class="project-meta">
            <span class="status-badge ${p.status}">${p.status}</span>
            · ${p.context_count || 0} items
          </div>
        </div>
        <div class="project-actions">
          ${isArchived
        ? `<button class="btn btn-sm btn-outline" data-action="restore" data-id="${p.project_id}" title="Restore & reopen tabs">↩</button>`
        : `<button class="btn btn-sm btn-outline" data-action="archive" data-id="${p.project_id}" title="Archive">📦</button>`
      }
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${p.project_id}" title="Delete permanently">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  els.projectList.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
      const id = el.dataset.id;
      const project = projects.find(p => p.project_id === id);
      if (!project) return;

      switch (action) {
        case 'switch': switchProject(project); break;
        case 'archive': archiveProject(project); break;
        case 'restore': restoreProject(project); break;
        case 'delete': deleteProject(project); break;
      }
    });
  });
}

function updateUI() {
  // Active project banner
  if (activeProject) {
    els.activeProjectBanner.style.display = 'block';
    els.activeProjectName.textContent = activeProject.name;
    els.activeProjectCount.textContent = `${activeProject.context_count || 0} items captured`;
  } else {
    els.activeProjectBanner.style.display = 'none';
  }

  // Capture toggle
  if (captureEnabled) {
    els.captureToggle.className = 'toggle-btn active';
    els.captureIcon.textContent = '●';
    els.captureIcon.style.color = '#4caf50';
  } else {
    els.captureToggle.className = 'toggle-btn paused';
    els.captureIcon.textContent = '⏸';
    els.captureIcon.style.color = '#888';
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

async function handleLogin() {
  const email = els.loginEmail.value;
  const password = els.loginPassword.value;
  try {
    await ContinuumAPI.login(email, password);
    els.authSection.style.display = 'none';
    loadProjects();
    setStatus('Logged in');
  } catch (err) {
    setStatus('Login failed');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
