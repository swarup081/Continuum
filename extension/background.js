// Continuum — Background Service Worker
// Handles message routing, API calls, badge state, and tab management

import { ContinuumAPI } from './utils/api-client.js';

// ─── State ──────────────────────────────────────────────────────────
let activeProject = null;
let captureEnabled = true;
let privacyRules = { blocked_domains: [], blocked_keywords: [] };

// ─── Initialize ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Continuum] Extension installed');
  await loadState();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadState();
  updateBadge();
});

// ─── Load stored state ──────────────────────────────────────────────
async function loadState() {
  const data = await chrome.storage.local.get([
    'activeProject',
    'captureEnabled',
    'privacyRules',
    'authToken'
  ]);
  activeProject = data.activeProject || null;
  captureEnabled = data.captureEnabled !== false;
  privacyRules = data.privacyRules || { blocked_domains: [], blocked_keywords: [] };
}

// ─── Badge management ───────────────────────────────────────────────
function updateBadge(tabUrl = null) {
  if (!activeProject) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  if (!captureEnabled) {
    chrome.action.setBadgeText({ text: '⏸' });
    chrome.action.setBadgeBackgroundColor({ color: '#888888' });
    return;
  }

  if (tabUrl && isBlockedDomain(tabUrl)) {
    chrome.action.setBadgeText({ text: '🚫' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
    return;
  }

  chrome.action.setBadgeText({ text: '●' });
  chrome.action.setBadgeBackgroundColor({ color: '#4caf50' });
}

function isBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return privacyRules.blocked_domains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// ─── Tab change → update badge ──────────────────────────────────────
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateBadge(tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateBadge(changeInfo.url);
  }
});

// ─── Message handler (from content scripts and popup) ───────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  await loadState();
  switch (message.type) {
    // ── From content scripts ──
    case 'CAPTURE_CONTENT': {
      if (!activeProject || !captureEnabled) {
        return { success: false, reason: 'No active project or capture disabled' };
      }
      if (sender.tab && isBlockedDomain(sender.tab.url)) {
        return { success: false, reason: 'Domain is blocked' };
      }
      return await ingestContent(message.payload);
    }

    case 'GET_STATE': {
      return {
        activeProject,
        captureEnabled,
        privacyRules,
        isBlocked: sender.tab ? isBlockedDomain(sender.tab.url) : false
      };
    }

    case 'GET_PRIMER': {
      if (!activeProject || !captureEnabled) return { primer: null };
      return await getPrimer();
    }

    case 'SEARCH_CONTEXT': {
      if (!activeProject) return { results: [] };
      try {
        const data = await ContinuumAPI.searchContext(activeProject.project_id, message.query, 3);
        return { results: data.results || [] };
      } catch (err) {
        console.error('[Continuum] Search failed:', err);
        return { results: [] };
      }
    }

    // ── From popup ──
    case 'SET_ACTIVE_PROJECT': {
      activeProject = message.project;
      await chrome.storage.local.set({ activeProject: message.project });
      updateBadge();
      return { success: true };
    }

    case 'TOGGLE_CAPTURE': {
      captureEnabled = message.enabled;
      await chrome.storage.local.set({ captureEnabled: message.enabled });
      updateBadge();
      return { success: true };
    }

    case 'UPDATE_PRIVACY_RULES': {
      privacyRules = message.rules;
      await chrome.storage.local.set({ privacyRules: message.rules });
      updateBadge();
      return { success: true };
    }

    case 'SAVE_TABS': {
      return await saveTabs(message.projectId);
    }

    case 'RESTORE_TABS': {
      return await restoreTabs(message.projectId);
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ─── API calls ──────────────────────────────────────────────────────
async function ingestContent(payload) {
  try {
    const result = await ContinuumAPI.ingest({
      project_id: activeProject.project_id,
      source_type: payload.source_type,
      source_name: payload.source_name,
      url: payload.url,
      content: payload.content,
      title: payload.title,
      captured_at: new Date().toISOString()
    });
    console.log('[Continuum] Ingested:', result.entry_id);
    return { success: true, entry_id: result.entry_id };
  } catch (err) {
    console.error('[Continuum] Ingest failed:', err);
    return { success: false, error: err.message };
  }
}

async function getPrimer() {
  try {
    const data = await ContinuumAPI.getPrimer(activeProject.project_id);
    return { primer: data.primer };
  } catch (err) {
    console.error('[Continuum] Primer fetch failed:', err);
    return { primer: null };
  }
}

async function saveTabs(projectId) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabData = tabs
      .filter(t => t.url && !t.url.startsWith('chrome://'))
      .map(t => ({ url: t.url, title: t.title || '' }));
    await ContinuumAPI.saveTabs(projectId, tabData);
    return { success: true, saved: tabData.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function restoreTabs(projectId) {
  try {
    const data = await ContinuumAPI.restoreProject(projectId);
    if (data.saved_tabs) {
      for (const url of data.saved_tabs) {
        chrome.tabs.create({ url, active: false });
      }
    }
    return { success: true, opened: data.saved_tabs?.length || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

