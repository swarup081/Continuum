// Continuum - Extension Popup
// Handles project switching, creation, archiving, and capture toggling

import { ContinuumAPI } from '../utils/api-client.js';

// State
let projects = [];
let activeProject = null;
let captureEnabled = true;

// DOM Elements
const els = {
  authSection: document.getElementById('authSection'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  loginBtn: document.getElementById('loginBtn'),
  showRegister: document.getElementById('showRegister'),
  captureToggle: document.getElementById('captureToggle'),
  captureIcon: document.getElementById('captureIcon'),
  activeProjectBanner: document.getElementById('activeProjectBanner'),
  activeProjectName: document.getElementById('activeProjectName'),
  activeProjectCount: document.getElementById('activeProjectCount'),
  newProjectName: document.getElementById('newProjectName'),
  createProjectBtn: document.getElementById('createProjectBtn'),
  projectList: document.getElementById('projectList'),
  statusText: document.getElementById('statusText'),
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadStoredState();
  await loadProjects();
});

// Event Listeners
function setupEventListeners() {
  els.captureToggle.addEventListener('click', toggleCapture);
  els.createProjectBtn.addEventListener('click', createProject);
  els.newProjectName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createProject();
  });
  els.loginBtn.addEventListener('click', handleLogin);
}

// Load State from Chrome Storage
async function loadStoredState() {
  const data = await chrome.storage.local.get(['activeProject', 'captureEnabled', 'authToken']);
  activeProject = data.activeProject || null;
  captureEnabled = data.captureEnabled !== false;

  if (!data.authToken) {
    els.authSection.style.display = 'block';
  } else {
    els.authSection.style.display = 'none';
  }

  updateUI();
}

// Load Projects from API
async function loadProjects() {
  try {
    setStatus('Loading projects...');
    const data = await ContinuumAPI.getProjects();
    projects = data.projects || [];

    // If active project is set, update its count from fresh data
    if (activeProject) {
      const fresh = projects.find(p => p.project_id === activeProject.project_id);
      if (fresh) {
        activeProject.context_count = fresh.context_count;
        activeProject.name = fresh.name;
        await chrome.storage.local.set({ activeProject });
      }
    }

    renderProjectList();
    updateUI();
    setStatus('Ready');
  } catch (err) {
    console.error('[Continuum] Failed to load projects:', err);
    if (err.message.includes('401')) {
      els.authSection.style.display = 'block';
      setStatus('Please log in');
    } else {
      setStatus('Offline / Backend unreachable');
    }
  }
}

// Create Project
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

// Switch Project
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

// Archive/Restore/Delete
async function archiveProject(project) {
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_TABS',
      projectId: project.project_id,
    });

    await ContinuumAPI.updateProject(project.project_id, { status: 'archived' });
    project.status = 'archived';

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

    await switchProject(project);

    renderProjectList();
    setStatus(`Restored "${project.name}"`);
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

// Toggle Capture
async function toggleCapture() {
  captureEnabled = !captureEnabled;

  await chrome.runtime.sendMessage({
    type: 'TOGGLE_CAPTURE',
    enabled: captureEnabled,
  });

  updateUI();
  setStatus(captureEnabled ? 'Capture enabled' : 'Capture paused');
}

// Render
function renderProjectList() {
  if (projects.length === 0) {
    els.projectList.innerHTML = '<div class="loading">No projects yet. Create one above!</div>';
    return;
  }

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
            <span>• ${p.context_count || 0} items</span>
          </div>
        </div>
        <div class="project-actions">
          ${isArchived
        ? `<button class="btn btn-sm btn-outline" data-action="restore" data-id="${p.project_id}" title="Restore & reopen tabs">Restore</button>`
        : `<button class="btn btn-sm btn-outline" data-action="archive" data-id="${p.project_id}" title="Archive">Archive</button>`
      }
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${p.project_id}" title="Delete permanently">×</button>
        </div>
      </div>
    `;
  }).join('');

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
  if (activeProject) {
    els.activeProjectBanner.style.display = 'block';
    els.activeProjectName.textContent = activeProject.name;
    els.activeProjectCount.textContent = `${activeProject.context_count || 0} items captured`;
  } else {
    els.activeProjectBanner.style.display = 'none';
  }

  if (captureEnabled) {
    els.captureToggle.className = 'toggle-btn active';
    els.captureIcon.textContent = '●';
    els.captureIcon.style.color = '#10b981';
  } else {
    els.captureToggle.className = 'toggle-btn paused';
    els.captureIcon.textContent = '⏸';
    els.captureIcon.style.color = '#6b7280';
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