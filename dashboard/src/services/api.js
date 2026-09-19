// API base URL — switch when backend is deployed
const USE_MOCK = true;
const API_BASE = 'https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod';

function getToken() {
  return localStorage.getItem('continuum_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

async function request(method, path, body = null) {
  if (USE_MOCK) return mockResponse(method, path, body);

  const options = { method, headers: authHeaders() };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// ─── Mock data ──────────────────────────────────────────────────────
const MOCK_PROJECTS = [
  { project_id: 'proj_1', name: 'Buy Phone', description: 'Comparing Samsung S25 vs iPhone 16', status: 'active', context_count: 8, created_at: '2026-09-17T22:00:00Z' },
  { project_id: 'proj_2', name: 'Research Paper — ML Transformers', description: 'Literature review on attention mechanisms', status: 'active', context_count: 15, created_at: '2026-09-17T18:00:00Z' },
  { project_id: 'proj_3', name: 'Debug Auth Middleware', description: 'JWT verification failing on refresh', status: 'active', context_count: 6, created_at: '2026-09-17T14:00:00Z' },
  { project_id: 'proj_4', name: 'Travel Planning — Goa', description: 'Dec trip planning', status: 'archived', context_count: 22, created_at: '2026-09-15T10:00:00Z' },
];

const MOCK_ENTRIES = [
  { entry_id: 'e1', source_type: 'llm_chat', source_name: 'ChatGPT', url: 'https://chatgpt.com/c/abc', title: 'Camera comparison', summary_text: 'Compared Samsung S25 Ultra 200MP sensor with 5x optical zoom vs iPhone 16 Pro 48MP with improved computational photography. S25 wins on hardware specs, iPhone on processing.', captured_at: '2026-09-17T22:30:00Z' },
  { entry_id: 'e2', source_type: 'webpage', source_name: 'gsmarena.com', url: 'https://gsmarena.com/samsung_s25_ultra_review', title: 'Samsung S25 Ultra Review', summary_text: 'GSMArena full review: 6.9" Dynamic AMOLED, Snapdragon 8 Elite, 5000mAh battery. Camera system praised for zoom capabilities. Battery life rated "excellent" at 124 hours.', captured_at: '2026-09-17T22:15:00Z' },
  { entry_id: 'e3', source_type: 'llm_chat', source_name: 'Gemini', url: 'https://gemini.google.com/app/xyz', title: 'Price comparison India', summary_text: 'Gemini provided current India prices: Samsung S25 Ultra 256GB at ₹1,29,999, iPhone 16 Pro 256GB at ₹1,34,900. Suggested checking Flipkart for exchange offers.', captured_at: '2026-09-17T22:00:00Z' },
  { entry_id: 'e4', source_type: 'webpage', source_name: 'amazon.in', url: 'https://amazon.in/Samsung-Galaxy-S25-Ultra', title: 'Samsung S25 Ultra - Amazon', summary_text: 'Amazon listing shows Samsung S25 Ultra at ₹1,24,999 with bank offers. HDFC card gets additional ₹5,000 off. Exchange bonus up to ₹10,000 on old devices.', captured_at: '2026-09-17T21:45:00Z' },
  { entry_id: 'e5', source_type: 'llm_chat', source_name: 'Claude', url: 'https://claude.ai/chat/def', title: 'Feature prioritization', summary_text: 'Asked Claude to help prioritize: camera quality, battery life, display, software updates. Claude suggested iPhone for long-term software support, Samsung for camera versatility.', captured_at: '2026-09-17T21:30:00Z' },
];

const MOCK_PROFILE = {
  facts: [
    { key: 'name', value: 'Swarup', updated_at: '2026-09-17T22:00:00Z' },
    { key: 'profession', value: 'CS Student, 3rd Year', updated_at: '2026-09-17T22:00:00Z' },
    { key: 'interest_1', value: 'Mobile technology & smartphones', updated_at: '2026-09-17T22:00:00Z' },
    { key: 'interest_2', value: 'Full-stack web development', updated_at: '2026-09-17T22:00:00Z' },
  ],
};

const MOCK_PRIVACY = {
  blocked_domains: ['web.whatsapp.com', 'mail.google.com', 'onlinesbi.com', 'netbanking.hdfcbank.com'],
  blocked_keywords: ['password', 'OTP', 'CVV', 'PIN', 'Aadhaar'],
  capture_enabled: true,
};

function mockResponse(method, path, body) {
  if (path === '/projects' && method === 'GET') return { projects: MOCK_PROJECTS };
  if (path === '/projects' && method === 'POST') {
    const p = { project_id: 'proj_' + Date.now(), ...body, status: 'active', context_count: 0, created_at: new Date().toISOString() };
    MOCK_PROJECTS.unshift(p);
    return p;
  }
  if (path.match(/\/projects\/\w+/) && method === 'PATCH') return { ...MOCK_PROJECTS[0], ...body };
  if (path.match(/\/projects\/\w+/) && method === 'DELETE') return {};
  if (path.match(/\/projects\/\w+\/restore/)) return { status: 'active', saved_tabs: [] };
  if (path.startsWith('/context/entries')) return { entries: MOCK_ENTRIES, next_cursor: null };
  if (path.startsWith('/context/primer')) {
    return { primer: '## Context loaded', project_name: 'Buy Phone', entry_count: MOCK_ENTRIES.length, last_updated: new Date().toISOString() };
  }
  if (path === '/context/search') {
    const query = (body?.query || '').toLowerCase();
    const filtered = MOCK_ENTRIES.filter(e => e.summary_text.toLowerCase().includes(query));
    return { results: (filtered.length ? filtered : MOCK_ENTRIES.slice(0, 3)).map((e, i) => ({ ...e, relevance_score: (0.95 - i * 0.08).toFixed(2) })) };
  }
  if (path === '/profile' && method === 'GET') return MOCK_PROFILE;
  if (path === '/profile' && method === 'PUT') { MOCK_PROFILE.facts = body.facts; return MOCK_PROFILE; }
  if (path === '/privacy' && method === 'GET') return MOCK_PRIVACY;
  if (path === '/privacy' && method === 'PUT') { Object.assign(MOCK_PRIVACY, body); return MOCK_PRIVACY; }
  return {};
}

// ─── Exported API ───────────────────────────────────────────────────
export const api = {
  login: (email, password) => {
    // Mock login
    localStorage.setItem('continuum_token', 'mock_token');
    localStorage.setItem('continuum_user', JSON.stringify({ user_id: 'user_1', email, name: email.split('@')[0] }));
    return Promise.resolve({ user_id: 'user_1', token: 'mock_token' });
  },
  register: (email, password, name) => {
    localStorage.setItem('continuum_token', 'mock_token');
    localStorage.setItem('continuum_user', JSON.stringify({ user_id: 'user_1', email, name }));
    return Promise.resolve({ user_id: 'user_1', token: 'mock_token' });
  },
  logout: () => {
    localStorage.removeItem('continuum_token');
    localStorage.removeItem('continuum_user');
  },
  getUser: () => JSON.parse(localStorage.getItem('continuum_user') || 'null'),
  isLoggedIn: () => !!localStorage.getItem('continuum_token'),

  getProjects: () => request('GET', '/projects'),
  createProject: (name, description) => request('POST', '/projects', { name, description }),
  updateProject: (id, updates) => request('PATCH', `/projects/${id}`, updates),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),
  restoreProject: (id) => request('POST', `/projects/${id}/restore`),

  getEntries: (projectId, limit = 20) => request('GET', `/context/entries?project_id=${projectId}&limit=${limit}`),
  searchContext: (projectId, query) => request('POST', '/context/search', { project_id: projectId, query }),

  getProfile: () => request('GET', '/profile'),
  updateProfile: (facts) => request('PUT', '/profile', { facts }),

  getPrivacy: () => request('GET', '/privacy'),
  updatePrivacy: (data) => request('PUT', '/privacy', data),
};
