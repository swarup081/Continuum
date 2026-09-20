// Continuum - Extension Popup
// Lightweight companion to the dashboard for quick project switching

import { ContinuumAPI } from '../utils/api-client.js';

const DASHBOARD_URL = 'http://continuum-backend-dashboardbucket-mj9fnz0vgvsv.s3-website-ap-southeast-2.amazonaws.com';

// State
let projects = [];
let activeProject = null;
let captureEnabled = true;

// DOM Elements
const els = {
  mainContent: document.getElementById('mainContent'),
  openDashboardBtn: document.getElementById('openDashboardBtn'),
  captureToggle: document.getElementById('captureToggle'),
  activeProjectBanner: document.getElementById('activeProjectBanner'),
  activeProjectName: document.getElementById('activeProjectName'),
  activeProjectCount: document.getElementById('activeProjectCount'),
  projectList: document.getElementById('projectList'),
  statusText: document.getElementById('statusText'),
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadStoredState();
});

// Event Listeners
function setupEventListeners() {
  els.captureToggle.addEventListener('click', toggleCapture);
  
  const openDashboard = () => chrome.tabs.create({ url: DASHBOARD_URL });
  els.openDashboardBtn.addEventListener('click', openDashboard);
}

// Load State from Chrome Storage
async function loadStoredState() {
  const data = await chrome.storage.local.get(['activeProject', 'captureEnabled']);
  activeProject = data.activeProject || null;
  captureEnabled = data.captureEnabled !== false;

  await loadProjects();
  updateUI();
}

// Load Projects from API
async function loadProjects() {
  try {
    setStatus('Loading projects...');
    const data = await ContinuumAPI.getProjects();
    projects = data.projects || [];

    // Filter to active projects only since dashboard handles archiving
    projects = projects.filter(p => p.status === 'active');

    // If active project is set, update its count from fresh data
    if (activeProject) {
      const fresh = projects.find(p => p.project_id === activeProject.project_id);
      if (fresh) {
        activeProject.context_count = fresh.context_count;
        activeProject.name = fresh.name;
        await chrome.storage.local.set({ activeProject });
      } else {
        // Active project might have been archived/deleted via dashboard
        activeProject = null;
        await chrome.runtime.sendMessage({ type: 'SET_ACTIVE_PROJECT', project: null });
      }
    }

    renderProjectList();
    updateUI();
    setStatus('Ready');
  } catch (err) {
    console.error('[Continuum] Failed to load projects:', err);
    if (err.message && err.message.includes('401')) {
      setStatus('Please log in via dashboard');
    } else {
      setStatus('Offline / Backend unreachable');
    }
    // Render empty state if we fail to fetch
    renderProjectList();
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
    els.projectList.innerHTML = '<div class="loading">No active projects.<br>Create one in the dashboard!</div>';
    return;
  }

  const sorted = [...projects].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  els.projectList.innerHTML = sorted.map(p => {
    const isActive = activeProject?.project_id === p.project_id;
    return `
      <div class="project-item ${isActive ? 'active' : ''}" data-id="${p.project_id}">
        <div class="project-info">
          <div class="project-name">${escapeHtml(p.name)}</div>
          <div class="project-meta">
            <span>${p.context_count || 0} items captured</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add click listeners to switch projects
  els.projectList.querySelectorAll('.project-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const project = projects.find(p => p.project_id === id);
      if (project) switchProject(project);
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
    els.captureToggle.title = "Capture is ON (Click to pause)";
  } else {
    els.captureToggle.className = 'toggle-btn paused';
    els.captureToggle.title = "Capture is PAUSED (Click to resume)";
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}