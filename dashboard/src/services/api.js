const CONFIG = {
  USE_MOCK: false,
  API_BASE: 'https://7h8hmfx6mg.execute-api.ap-southeast-2.amazonaws.com/prod',
};

function getToken() {
  return localStorage.getItem('continuum_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

// ─── Mock Data ──────────────────────────────────────────────────────
const MOCK_PROJECTS = [
  { project_id: 'proj_1', name: 'Buy Phone', description: 'Researching best phones under 30k', status: 'active', context_count: 12, created_at: '2026-09-17T22:00:00Z' },
  { project_id: 'proj_2', name: 'Research Paper', description: 'ML paper on transformer architectures', status: 'active', context_count: 8, created_at: '2026-09-16T20:00:00Z' },
  { project_id: 'proj_3', name: 'Debug Auth Bug', description: 'Fix the login token refresh issue', status: 'archived', context_count: 5, created_at: '2026-09-15T10:00:00Z' },
];

const MOCK_ENTRIES = [
  { entry_id: 'entry_1', source_name: 'ChatGPT', source_type: 'llm_chat', url: 'https://chatgpt.com/c/abc123', summary_text: 'Discussed OnePlus 12 vs Samsung S24 comparison. OnePlus offers better value with faster charging (100W) and similar camera quality. Samsung has better software support.', captured_at: '2026-09-17T22:30:00Z' },
  { entry_id: 'entry_2', source_name: 'Gemini', source_type: 'llm_chat', url: 'https://gemini.google.com/chat/xyz', summary_text: 'Analyzed battery benchmarks for flagship phones. OnePlus 12 lasts 14 hours screen-on-time, Samsung S24 lasts 12 hours. Pixel 9 Pro sits at 11 hours.', captured_at: '2026-09-17T21:00:00Z' },
  { entry_id: 'entry_3', source_name: 'GSMArena', source_type: 'web_page', url: 'https://gsmarena.com/oneplus_12-review.html', summary_text: 'GSMArena review highlights the Snapdragon 8 Gen 3 performance, 120Hz LTPO AMOLED display, and Hasselblad camera system. Rated 4.5/5 overall.', captured_at: '2026-09-17T20:00:00Z' },
  { entry_id: 'entry_4', source_name: 'ChatGPT', source_type: 'llm_chat', url: 'https://chatgpt.com/c/def456', summary_text: 'Created a comparison table of top 5 phones under 30k INR with specs, pros, and cons. Recommended OnePlus 12R as best overall value pick.', captured_at: '2026-09-17T19:00:00Z' },
  { entry_id: 'entry_5', source_name: 'Reddit', source_type: 'web_page', url: 'https://reddit.com/r/india/comments/phone_advice', summary_text: 'Community discussion about phone purchases in India. Users recommend waiting for Diwali sales for better prices. Many suggest OnePlus for stock-like Android experience.', captured_at: '2026-09-17T18:00:00Z' },
];

const MOCK_PROFILE = {
  user_id: 'mock_user',
  facts: [
    { key: 'name', value: 'Swarup', updated_at: '2026-09-17T10:00:00Z' },
    { key: 'profession', value: 'Computer Science Student', updated_at: '2026-09-17T10:00:00Z' },
    { key: 'interest_1', value: 'Machine Learning & AI', updated_at: '2026-09-17T10:00:00Z' },
    { key: 'interest_2', value: 'Full-Stack Development', updated_at: '2026-09-17T10:00:00Z' },
  ],
};

const MOCK_PRIVACY = {
  blocked_domains: ['web.whatsapp.com', 'mail.google.com', 'onlinesbi.com', 'netbanking.hdfcbank.com'],
  blocked_keywords: ['password', 'OTP', 'CVV', 'PIN'],
  capture_enabled: true,
};

// ─── API Client ─────────────────────────────────────────────────────
const api = {
  // ── Auth ──
  async login(email, password) {
    if (CONFIG.USE_MOCK) {
      const data = { user_id: 'mock_user', token: 'mock_token_abc123', refresh_token: 'mock_refresh' };
      localStorage.setItem('continuum_token', data.token);
      localStorage.setItem('continuum_user', JSON.stringify({ user_id: data.user_id, email }));
      return data;
    }
    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Login failed: ${res.status}`);
    }
    const data = await res.json();
    localStorage.setItem('continuum_token', data.token);
    localStorage.setItem('continuum_user', JSON.stringify({ user_id: data.user_id, email }));
    return data;
  },

  async register(email, password, name) {
    if (CONFIG.USE_MOCK) {
      const data = { user_id: 'mock_user', token: 'mock_token_abc123', refresh_token: 'mock_refresh' };
      localStorage.setItem('continuum_token', data.token);
      localStorage.setItem('continuum_user', JSON.stringify({ user_id: data.user_id, email, name }));
      return data;
    }
    const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Register failed: ${res.status}`);
    }
    const data = await res.json();
    localStorage.setItem('continuum_token', data.token);
    localStorage.setItem('continuum_user', JSON.stringify({ user_id: data.user_id, email, name }));
    return data;
  },

  // ── Projects ──
  async getProjects() {
    if (CONFIG.USE_MOCK) return { projects: [...MOCK_PROJECTS] };
    const res = await fetch(`${CONFIG.API_BASE}/projects`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
    return res.json();
  },

  async createProject(name, description = '') {
    if (CONFIG.USE_MOCK) {
      const project = { project_id: 'proj_' + Date.now(), name, description, status: 'active', context_count: 0, created_at: new Date().toISOString() };
      MOCK_PROJECTS.unshift(project);
      return project;
    }
    const res = await fetch(`${CONFIG.API_BASE}/projects`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
    return res.json();
  },

  async updateProject(projectId, updates) {
    if (CONFIG.USE_MOCK) {
      const idx = MOCK_PROJECTS.findIndex(p => p.project_id === projectId);
      if (idx !== -1) Object.assign(MOCK_PROJECTS[idx], updates);
      return MOCK_PROJECTS[idx];
    }
    const res = await fetch(`${CONFIG.API_BASE}/projects/${projectId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update project: ${res.status}`);
    return res.json();
  },

  async restoreProject(projectId) {
    if (CONFIG.USE_MOCK) {
      const idx = MOCK_PROJECTS.findIndex(p => p.project_id === projectId);
      if (idx !== -1) MOCK_PROJECTS[idx].status = 'active';
      return { project_id: projectId, status: 'active', saved_tabs: [] };
    }
    const res = await fetch(`${CONFIG.API_BASE}/projects/${projectId}/restore`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to restore project: ${res.status}`);
    return res.json();
  },

  async deleteProject(projectId) {
    if (CONFIG.USE_MOCK) {
      const idx = MOCK_PROJECTS.findIndex(p => p.project_id === projectId);
      if (idx !== -1) MOCK_PROJECTS.splice(idx, 1);
      return {};
    }
    const res = await fetch(`${CONFIG.API_BASE}/projects/${projectId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete project: ${res.status}`);
    return {};
  },

  // ── Context ──
  async getEntries(projectId, limit = 20, cursor = null) {
    if (CONFIG.USE_MOCK) return { entries: [...MOCK_ENTRIES], next_cursor: null };
    let url = `${CONFIG.API_BASE}/context/entries?project_id=${projectId}&limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch entries: ${res.status}`);
    return res.json();
  },

  async getRawEntry(entryId) {
    const res = await fetch(`/context/entries//raw`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch raw entry: `);
    return res.json();
  },

  async updateEntry(entryId, rawContent) {
    const res = await fetch(`/context/entries/`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ raw_content: rawContent }),
    });
    if (!res.ok) throw new Error(`Failed to update entry: `);
    return res.json();
  },

  async searchContext(projectId, query, topK = 5) {
    if (CONFIG.USE_MOCK) {
      const q = query.toLowerCase();
      const results = MOCK_ENTRIES
        .filter(e => e.summary_text.toLowerCase().includes(q) || e.source_name.toLowerCase().includes(q))
        .map((e, i) => ({ ...e, relevance_score: +(0.95 - i * 0.08).toFixed(4) }));
      return { results: results.length > 0 ? results : MOCK_ENTRIES.slice(0, 2).map((e, i) => ({ ...e, relevance_score: +(0.65 - i * 0.1).toFixed(4) })) };
    }
    const res = await fetch(`${CONFIG.API_BASE}/context/search`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ project_id: projectId, query, top_k: topK }),
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  },

  // ── Profile ──
  async getProfile() {
    if (CONFIG.USE_MOCK) return { ...MOCK_PROFILE };
    const res = await fetch(`${CONFIG.API_BASE}/profile`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
    return res.json();
  },

  async updateProfile(facts) {
    if (CONFIG.USE_MOCK) {
      MOCK_PROFILE.facts = facts;
      return { user_id: 'mock_user', facts };
    }
    const res = await fetch(`${CONFIG.API_BASE}/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ facts }),
    });
    if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
    return res.json();
  },

  // ── Privacy ──
  async getPrivacy() {
    if (CONFIG.USE_MOCK) return { ...MOCK_PRIVACY };
    const res = await fetch(`${CONFIG.API_BASE}/privacy`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch privacy: ${res.status}`);
    return res.json();
  },

  async updatePrivacy(data) {
    if (CONFIG.USE_MOCK) {
      Object.assign(MOCK_PRIVACY, data);
      return { ...MOCK_PRIVACY };
    }
    const res = await fetch(`${CONFIG.API_BASE}/privacy`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update privacy: ${res.status}`);
    return res.json();
  },
};

export default api;


