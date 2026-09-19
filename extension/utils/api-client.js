// Continuum — API Client
// Wrapper for all backend API calls

const CONFIG = {
  // Toggle for development — set to true for hardcoded mock responses
  USE_MOCK: false,
  API_BASE: 'http://localhost:3001',
};

// ─── Auth helpers ───────────────────────────────────────────────────
async function getAuthToken() {
  const data = await chrome.storage.local.get('authToken');
  return data.authToken || '';
}

async function authHeaders() {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ─── API Client ─────────────────────────────────────────────────────
export const ContinuumAPI = {
  // ── Auth ──
  async login(email, password) {
    if (CONFIG.USE_MOCK) return { user_id: 'mock_user', token: 'mock_token', refresh_token: 'mock_refresh' };
    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    await chrome.storage.local.set({ authToken: data.token });
    return data;
  },

  async register(email, password, name) {
    if (CONFIG.USE_MOCK) return { user_id: 'mock_user', token: 'mock_token' };
    const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) throw new Error(`Register failed: ${res.status}`);
    const data = await res.json();
    await chrome.storage.local.set({ authToken: data.token });
    return data;
  },

  // ── Projects ──
  async getProjects() {
    if (CONFIG.USE_MOCK) {
      return {
        projects: [
          { project_id: 'proj_1', name: 'Buy Phone', status: 'active', context_count: 5, created_at: '2026-09-17T22:00:00Z' },
          { project_id: 'proj_2', name: 'Research Paper', status: 'active', context_count: 3, created_at: '2026-09-17T20:00:00Z' },
        ]
      };
    }
    const res = await fetch(`${CONFIG.API_BASE}/projects`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`Get projects failed: ${res.status}`);
    return res.json();
  },

  async createProject(name, description = '') {
    if (CONFIG.USE_MOCK) {
      return { project_id: 'proj_' + Date.now(), name, status: 'active', context_count: 0, created_at: new Date().toISOString() };
    }
    const res = await fetch(`${CONFIG.API_BASE}/projects`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(`Create project failed: ${res.status}`);
    return res.json();
  },

  async updateProject(projectId, updates) {
    if (CONFIG.USE_MOCK) return { project_id: projectId, ...updates };
    const res = await fetch(`${CONFIG.API_BASE}/projects/${projectId}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update project failed: ${res.status}`);
    return res.json();
  },

  async restoreProject(projectId) {
    if (CONFIG.USE_MOCK) return { project_id: projectId, status: 'active', saved_tabs: [] };
    const res = await fetch(`${CONFIG.API_BASE}/projects/${projectId}/restore`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error(`Restore project failed: ${res.status}`);
    return res.json();
  },

  async deleteProject(projectId) {
    if (CONFIG.USE_MOCK) return {};
    const res = await fetch(`${CONFIG.API_BASE}/projects/${projectId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error(`Delete project failed: ${res.status}`);
    return {};
  },

  // ── Ingest ──
  async ingest(data) {
    if (CONFIG.USE_MOCK) {
      console.log('[MOCK] Ingesting:', data.source_name, data.url);
      return { entry_id: 'entry_' + Date.now(), status: 'processing' };
    }
    const res = await fetch(`${CONFIG.API_BASE}/ingest`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Ingest failed: ${res.status}`);
    return res.json();
  },

  async saveTabs(projectId, tabs) {
    if (CONFIG.USE_MOCK) return { saved: tabs.length };
    const res = await fetch(`${CONFIG.API_BASE}/ingest/tabs`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ project_id: projectId, tabs }),
    });
    if (!res.ok) throw new Error(`Save tabs failed: ${res.status}`);
    return res.json();
  },

  // ── Context ──
  async getPrimer(projectId) {
    if (CONFIG.USE_MOCK) {
      return {
        primer: `## Your Context (via Continuum)\n\n**About you:** Mock user, CS student.\n\n**Active Project:** Mock Project\nThis is mock context for development testing.`,
        project_name: 'Mock Project',
        last_updated: new Date().toISOString(),
      };
    }
    const res = await fetch(`${CONFIG.API_BASE}/context/primer?project_id=${projectId}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error(`Get primer failed: ${res.status}`);
    return res.json();
  },

  async searchContext(projectId, query, topK = 5) {
    if (CONFIG.USE_MOCK) {
      return { results: [{ entry_id: 'mock_1', summary_text: 'Mock search result', source_name: 'Mock', relevance_score: 0.9 }] };
    }
    const res = await fetch(`${CONFIG.API_BASE}/context/search`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ project_id: projectId, query, top_k: topK }),
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  },

  // ── Profile ──
  async getProfile() {
    if (CONFIG.USE_MOCK) return { facts: [{ key: 'name', value: 'Mock User' }] };
    const res = await fetch(`${CONFIG.API_BASE}/profile`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`Get profile failed: ${res.status}`);
    return res.json();
  },

  // ── Privacy ──
  async getPrivacy() {
    if (CONFIG.USE_MOCK) {
      return {
        blocked_domains: ['web.whatsapp.com', 'mail.google.com', 'onlinesbi.com'],
        blocked_keywords: ['password', 'OTP', 'CVV'],
        capture_enabled: true,
      };
    }
    const res = await fetch(`${CONFIG.API_BASE}/privacy`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`Get privacy failed: ${res.status}`);
    return res.json();
  },
};
