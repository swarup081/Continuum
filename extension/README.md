# 🔵 Workstream A — Browser Extension

> **Owner:** TBD
> **Tech:** JavaScript, Chrome Extension Manifest V3, Chrome APIs
> **Depends on:** `API_CONTRACTS.md` (mock until backend is live)

## What You Own

You build the **entire browser-side experience**:
1. Content scripts that capture context from LLM chat sites (ChatGPT, Gemini) and generic webpages
2. Project create/switch popup UI (triggered by keyboard shortcut)
3. Local privacy pre-filter (strips OTPs, card numbers, passwords before sending to backend)
4. Context primer injection into LLM chat boxes (the fallback that always works)
5. Capture indicator (badge on extension icon)
6. Tab saving for project archive/restore

## Setup

```bash
cd extension

# No npm install needed — pure Chrome Extension (vanilla JS)
# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked" → select this extension/ folder
```

## How to Test

1. Load the extension in Chrome
2. Click the extension icon → create a project
3. Open ChatGPT → have a conversation → check console for captured text
4. Open any webpage → extension should extract main content
5. Check the badge color (green = capturing, gray = paused)

## File Structure You Need to Build

```
extension/
├── manifest.json              ← Already created (see below)
├── background.js              ← Service worker: API calls, routing, state
├── popup/
│   ├── popup.html             ← Project switcher UI
│   ├── popup.css              ← Styling
│   └── popup.js               ← Project CRUD, switch active project
├── content-scripts/
│   ├── chatgpt.js             ← DOM observer for chatgpt.com
│   ├── gemini.js              ← DOM observer for gemini.google.com
│   ├── generic.js             ← Generic webpage text extractor
│   └── injector.js            ← Injects context primer into chat input boxes
├── utils/
│   ├── privacy-filter.js      ← Local PII regex filter
│   ├── api-client.js          ← Wrapper for all backend API calls
│   └── storage.js             ← chrome.storage helpers
└── icons/                     ← Extension icons (16, 48, 128px)
```

## Detailed Task Breakdown

### Phase 1: Skeleton + Project UI
- [ ] Set up `manifest.json` (already scaffolded)
- [ ] Build `popup.html` — simple UI with:
  - Text input + "Create Project" button
  - List of existing projects (active first, then archived)
  - Click to switch active project
  - Archive/restore buttons per project
- [ ] `popup.js` — calls `POST /projects`, `GET /projects`, `PATCH /projects/{id}`
- [ ] `storage.js` — helpers for `chrome.storage.local`:
  - `getActiveProject()` → returns `{project_id, name}`
  - `setActiveProject(project)` → stores active project
  - `getAuthToken()` / `setAuthToken(token)`
  - `getPrivacyRules()` / `setPrivacyRules(rules)`
- [ ] `background.js` — service worker:
  - Listen for `chrome.commands` → `Ctrl+Shift+P` opens popup
  - Handle messages from content scripts
  - Route captured content to backend via `api-client.js`

### Phase 2: Content Capture Scripts
- [ ] `chatgpt.js` — Content script for `chatgpt.com`:
  ```
  HOW IT WORKS:
  1. Use MutationObserver to watch for new chat messages
  2. ChatGPT renders messages in <div class="markdown"> inside conversation turns
  3. On each new message, extract the text content
  4. Batch messages (don't send every single message — buffer for 10s or on page unload)
  5. Send batched content to background.js → POST /ingest
  ```
  - Key DOM selectors to investigate: `[data-message-author-role]`, `.markdown`, `main` conversation container
  - **Important**: ChatGPT uses React — the DOM updates dynamically. Use `MutationObserver` on the main conversation container.

- [ ] `gemini.js` — Content script for `gemini.google.com`:
  ```
  HOW IT WORKS:
  1. Similar MutationObserver approach
  2. Gemini renders in message-content containers
  3. Look for response containers and user message containers
  4. Same batching logic as ChatGPT
  ```
  - Key DOM selectors to investigate: `message-content`, `.response-container`, `.user-query`

- [ ] `generic.js` — Content script for all other websites:
  ```
  HOW IT WORKS:
  1. Runs on page load (after DOM ready)
  2. Extract "main content" using heuristics:
     a. Look for <article> tag
     b. Look for <main> tag
     c. Look for the largest text block (most <p> tags)
     d. Fall back to document.body.innerText (truncated)
  3. Limit to 10,000 characters
  4. Send to background.js → POST /ingest with source_type: "webpage"
  ```
  - Only capture if the domain is NOT in the blocked list
  - Only capture if there's an active project
  - Only capture if `capture_enabled` is true

### Phase 3: Privacy Pre-Filter
- [ ] `privacy-filter.js`:
  ```javascript
  // Patterns to strip BEFORE sending to backend
  const PII_PATTERNS = [
    { name: 'credit_card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
    { name: 'otp', regex: /\b(?:OTP|otp|Otp)[\s:]*\d{4,8}\b/g, replacement: '[OTP_REDACTED]' },
    { name: 'password', regex: /(?:password|passwd|pwd)[\s:=]+\S+/gi, replacement: '[PASSWORD_REDACTED]' },
    { name: 'aadhaar', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: '[AADHAAR_REDACTED]' },
    { name: 'phone_in', regex: /\b(?:\+91[\s-]?)?\d{10}\b/g, replacement: '[PHONE_REDACTED]' },
    { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
  ];
  
  function filterPII(text, blockedKeywords = []) {
    let filtered = text;
    for (const pattern of PII_PATTERNS) {
      filtered = filtered.replace(pattern.regex, pattern.replacement);
    }
    for (const keyword of blockedKeywords) {
      filtered = filtered.replaceAll(keyword, '[BLOCKED]');
    }
    return filtered;
  }
  ```

### Phase 4: Context Primer Injection
- [ ] `injector.js` — The **killer feature fallback** that always works:
  ```
  HOW IT WORKS:
  1. When user opens a NEW chat on any LLM site
  2. Fetch GET /context/primer?project_id=ACTIVE_PROJECT
  3. Find the chat input box (textarea/contenteditable)
  4. Inject the primer text as the first message or prepend to user's first message
  5. User can see it and edit/remove before sending
  
  SITE-SPECIFIC INPUT SELECTORS:
  - ChatGPT: #prompt-textarea or textarea[data-id="prompt-textarea"]
  - Gemini: .ql-editor or rich-textarea
  - Claude: div[contenteditable="true"] in the composer
  ```
  - **Don't auto-send** — just populate the text box. Let the user review and send.
  - Add a small "📎 Continuum context loaded" badge near the input box so user knows it happened.

### Phase 5: Tab Saving + Indicators
- [ ] On project archive: collect all open tab URLs → `POST /ingest/tabs`
- [ ] On project restore: read saved tabs from `POST /projects/{id}/restore` → open them via `chrome.tabs.create()`
- [ ] Badge states:
  - 🟢 Green badge: actively capturing for current project
  - ⬜ Gray badge: capture paused
  - 🔴 Red badge: current site is blocked
  - No badge: no active project

### Phase 6: Polish
- [ ] Clean popup UI (dark theme, smooth transitions)
- [ ] Error handling for all API calls (retry logic, offline handling)
- [ ] Options page for entering API URL and login credentials
- [ ] Test on Chrome stable, verify no console errors

## Mock API for Development

Until the backend is live, use this mock approach in `api-client.js`:

```javascript
const USE_MOCK = true; // Switch to false once backend is deployed
const API_BASE = USE_MOCK ? 'http://localhost:3001' : 'https://YOUR_API_URL.amazonaws.com/prod';

// Or simply return hardcoded responses:
async function mockIngest(data) {
  console.log('[MOCK] Ingesting:', data);
  return { entry_id: 'mock_' + Date.now(), status: 'processing' };
}

async function mockGetPrimer(projectId) {
  return {
    primer: "## Your Context (via Continuum)\n\n**About you:** Test user.\n\n**Active Project:** Test Project\nThis is mock context for development.",
    project_name: "Test Project",
    last_updated: new Date().toISOString()
  };
}
```

## Key Chrome APIs You'll Use

| API | What For |
|---|---|
| `chrome.storage.local` | Store active project, auth token, privacy rules |
| `chrome.tabs` | Get current tab URL/title, open tabs on restore |
| `chrome.action` | Set badge text and color |
| `chrome.commands` | Keyboard shortcut (Ctrl+Shift+P) |
| `chrome.runtime.sendMessage` | Content script → background communication |
| `chrome.runtime.onMessage` | Background listener for content script messages |

## Integration Checklist

When the backend (WS-B) is live:
- [ ] Update `API_BASE` in `api-client.js`
- [ ] Test `POST /ingest` with real captured content
- [ ] Test `GET /context/primer` and verify injection works
- [ ] Test `GET /projects` from popup
- [ ] Verify auth token flow with Cognito
- [ ] Test domain blocking with `GET /privacy`
