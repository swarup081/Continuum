# 🔴 Workstream D — Web Dashboard + Integration Lead

> **Owner:** TBD (suggest: team lead / Anurag)
> **Tech:** React (Vite), vanilla CSS, Cognito SDK
> **Depends on:** `API_CONTRACTS.md` (mock until backend is live)
> **Extra role:** Integration lead — you own the final wiring, demo video, writeup, and submission

## What You Own

### Dashboard (primary deliverable)
1. **Login/Register pages** — Cognito authentication
2. **Projects page** — list, create, archive, restore, delete projects
3. **Project Detail page** — view captured context entries, summaries, source links
4. **Universal Profile page** — edit name, profession, interests
5. **Privacy Settings page** — manage blocked domains, keywords, capture toggle
6. **Activity Feed** — recent captures across all projects

### Integration + Submission (secondary role)
1. Final wiring of all 4 workstreams
2. End-to-end testing
3. Demo video recording (≤3 min)
4. Writeup
5. Repo cleanup and submission

## Prerequisites

```bash
# Node.js 20+
node --version

# npm
npm --version
```

## Setup

```bash
cd dashboard

# Install dependencies
npm install

# Start dev server
npm run dev
# → Opens at http://localhost:5173

# Build for production
npm run build
```

## File Structure

```
dashboard/
├── package.json
├── vite.config.js
├── index.html
├── public/
│   └── continuum-logo.svg
├── src/
│   ├── main.jsx                   ← React entry point
│   ├── App.jsx                    ← Router + layout
│   ├── App.css                    ← Global styles + design system
│   ├── pages/
│   │   ├── Login.jsx              ← Cognito login form
│   │   ├── Register.jsx           ← Cognito register form
│   │   ├── Projects.jsx           ← Project list + create
│   │   ├── ProjectDetail.jsx      ← Context entries for a project
│   │   ├── Profile.jsx            ← Universal profile editor
│   │   └── Privacy.jsx            ← Blocked domains/keywords + capture toggle
│   ├── components/
│   │   ├── Navbar.jsx             ← Top navigation bar
│   │   ├── Sidebar.jsx            ← Side navigation
│   │   ├── ProjectCard.jsx        ← Individual project card
│   │   ├── ContextEntry.jsx       ← Individual context entry display
│   │   ├── ProtectedRoute.jsx     ← Auth guard wrapper
│   │   └── LoadingSpinner.jsx     ← Loading state
│   ├── services/
│   │   ├── api.js                 ← Backend API client
│   │   └── auth.js                ← Cognito authentication
│   └── utils/
│       └── constants.js           ← API URLs, config
```

## Detailed Task Breakdown

### Phase 1: Scaffold + Auth
- [ ] Scaffold React app (already done — `npx create-vite@latest`)
- [ ] Install dependencies:
  ```bash
  npm install react-router-dom amazon-cognito-identity-js
  ```
- [ ] Set up routing in `App.jsx`:
  ```
  / → redirect to /projects (if logged in) or /login
  /login → Login page
  /register → Register page
  /projects → Project list
  /projects/:id → Project detail
  /profile → Universal profile
  /privacy → Privacy settings
  ```
- [ ] Implement `services/auth.js`:
  ```javascript
  // Using amazon-cognito-identity-js
  import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
  
  const userPool = new CognitoUserPool({
    UserPoolId: 'YOUR_USER_POOL_ID',  // From WS-B
    ClientId: 'YOUR_CLIENT_ID'        // From WS-B
  });
  
  export function register(email, password, name) { ... }
  export function login(email, password) { ... }
  export function logout() { ... }
  export function getCurrentToken() { ... }
  export function isAuthenticated() { ... }
  ```
- [ ] Build `Login.jsx` and `Register.jsx` — forms with email/password
- [ ] Build `ProtectedRoute.jsx` — redirects to /login if not authenticated
- [ ] Test auth flow (can use mock or real Cognito)

### Phase 2: Projects Page
- [ ] `Projects.jsx`:
  - Header with "Create Project" button (opens modal/inline form)
  - Grid/list of `ProjectCard` components
  - Tabs: "Active" | "Archived" filtering
  - Each card shows: name, description, context count, created date
  - Card actions: Archive, Restore, Delete (with confirmation modal)
- [ ] `ProjectCard.jsx`:
  - Clean card design with hover effects
  - Status badge (green = active, gray = archived)
  - Click → navigates to project detail
  - Action buttons (archive/restore/delete)

### Phase 3: Project Detail Page
- [ ] `ProjectDetail.jsx`:
  - Project name + status at top
  - Tab bar: "Context Entries" | "Search"
  - **Context Entries tab**: paginated list of `ContextEntry` components
  - **Search tab**: search input → calls `POST /context/search` → shows results
- [ ] `ContextEntry.jsx`:
  - Source icon (ChatGPT logo, Gemini logo, web icon)
  - Source name + URL (clickable link)
  - Summary text
  - Timestamp
  - Expand to show full text (from S3 — stretch goal)

### Phase 4: Profile + Privacy Pages
- [ ] `Profile.jsx`:
  - Form with key-value pairs (name, profession, interest_1, interest_2)
  - "Save" button → `PUT /profile`
  - Show last updated timestamps
  - Info text: "This profile is shared with LLMs to give them context about you"
- [ ] `Privacy.jsx`:
  - **Blocked Domains** section:
    - List of blocked domains with "Remove" button each
    - "Add domain" input + button
    - Default suggestions: whatsapp.com, mail.google.com, onlinesbi.com
  - **Blocked Keywords** section:
    - Same pattern as domains
    - Default suggestions: password, OTP, CVV, PIN
  - **Master Toggle**: capture_enabled on/off switch
  - "Save" button → `PUT /privacy`

### Phase 5: Styling
- [ ] Design system in `App.css`:
  ```
  COLOR PALETTE (dark theme):
  --bg-primary: #0a0a0f
  --bg-secondary: #12121a
  --bg-card: #1a1a2e
  --accent: #6c63ff (purple)
  --accent-hover: #7c74ff
  --text-primary: #e0e0e0
  --text-secondary: #888
  --success: #4caf50
  --warning: #ff9800
  --danger: #f44336
  --border: #2a2a3e
  ```
- [ ] Responsive layout (sidebar collapses on mobile)
- [ ] Hover effects on cards, buttons
- [ ] Smooth page transitions
- [ ] Loading states (skeleton loaders or spinners)
- [ ] Toast notifications for success/error

### Phase 6: Integration Lead Tasks
- [ ] Wire all workstreams together:
  - Get API URL from WS-B → update dashboard + share with WS-A and WS-C
  - Get Cognito credentials → update auth config
  - Test end-to-end flow
- [ ] Full end-to-end test scenario:
  ```
  1. Register user in dashboard
  2. Create "Buy Phone" project
  3. Set up profile (name, profession)
  4. Install extension → create project shows in extension popup
  5. Open ChatGPT → chat about phones → extension captures
  6. Open a review website → extension captures
  7. Check dashboard → context entries appear
  8. Open Gemini → primer auto-injected
  ```
- [ ] Record demo video (≤3 min):
  | Time | Content |
  |---|---|
  | 0:00–0:15 | Problem: re-explaining context to different LLMs |
  | 0:15–0:30 | Continuum intro |
  | 0:30–1:30 | Live demo: create project, capture, switch LLM with context |
  | 1:30–2:00 | AWS beat: CloudWatch/Bedrock/DynamoDB console on screen |
  | 2:00–2:30 | Dashboard tour |
  | 2:30–3:00 | Architecture + team |
- [ ] Write submission writeup
- [ ] Update `AI_TOOLS_USED.md` — collect from all team members
- [ ] Repo cleanup: README, .gitignore, no secrets committed
- [ ] Upload video to YouTube (unlisted), verify playback in incognito
- [ ] Submit via hackathon form

## Mock API for Development

```javascript
// services/api.js — Mock mode
const USE_MOCK = true;
const API_BASE = USE_MOCK ? '' : 'https://YOUR_API.amazonaws.com/prod';

const MOCK_PROJECTS = [
  { project_id: 'proj_1', name: 'Buy Phone', status: 'active', context_count: 5, created_at: '2026-09-17T22:00:00Z' },
  { project_id: 'proj_2', name: 'Research Paper', status: 'active', context_count: 12, created_at: '2026-09-17T20:00:00Z' },
  { project_id: 'proj_3', name: 'Debug Auth Bug', status: 'archived', context_count: 8, created_at: '2026-09-16T10:00:00Z' },
];

export async function getProjects() {
  if (USE_MOCK) return { projects: MOCK_PROJECTS };
  return fetch(`${API_BASE}/projects`, { headers: authHeaders() }).then(r => r.json());
}
// ... same pattern for all endpoints
```

## Deploy to AWS

Option A — **Amplify Hosting** (recommended for hackathon):
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize (one-time)
amplify init

# Deploy
amplify publish
```

Option B — **S3 + CloudFront** (manual):
```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://continuum-dashboard-bucket/

# Create CloudFront distribution pointing to S3
```

## Integration Checklist

When the backend (WS-B) is live:
- [ ] Update `API_BASE` in `services/api.js`
- [ ] Update Cognito User Pool ID and Client ID in `services/auth.js`
- [ ] Test all CRUD operations with real API
- [ ] Verify auth flow end-to-end
- [ ] Test project create → appears in extension popup
- [ ] Test context entries appear after extension capture
