// Continuum — ChatGPT Content Script
// Captures conversation content from chatgpt.com using MutationObserver

(function () {
  'use strict';

  const SOURCE_NAME = 'ChatGPT';
  const SOURCE_TYPE = 'llm_chat';
  const BATCH_INTERVAL_MS = 15000; // Send batched content every 15 seconds
  const MIN_CONTENT_LENGTH = 50;   // Don't capture tiny fragments

  let messageBuffer = [];
  let lastCapturedIndex = 0;
  let observer = null;
  let batchTimer = null;
  let state = null;

  // ─── Initialize ─────────────────────────────────────────────────
  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state.activeProject || !state.captureEnabled || state.isBlocked) {
      console.log('[Continuum] ChatGPT capture inactive:', {
        hasProject: !!state.activeProject,
        captureEnabled: state.captureEnabled,
        isBlocked: state.isBlocked,
      });
      return;
    }

    console.log('[Continuum] ChatGPT capture active for project:', state.activeProject.name);
    startObserving();
    startBatchTimer();
  }

  // ─── DOM Observation ──────────────────────────────────────────────
  function startObserving() {
    // ChatGPT renders conversation in a main container
    // We observe the entire main area and look for message elements
    const targetNode = document.querySelector('main') || document.body;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          extractNewMessages();
        }
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });

    // Also capture what's already on the page
    extractNewMessages();
  }

  function extractNewMessages() {
    // ChatGPT message selectors (may change — update as needed)
    const messageSelectors = [
      '[data-message-author-role]',        // Primary selector
      '.markdown',                          // Rendered markdown content
      '[data-testid*="conversation-turn"]', // Conversation turns
    ];

    let messages = [];
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        break;
      }
    }

    // Only process new messages (after lastCapturedIndex)
    const newMessages = messages.slice(lastCapturedIndex);

    for (const msg of newMessages) {
      const role = msg.getAttribute('data-message-author-role') || 'unknown';
      const text = msg.innerText?.trim();

      if (text && text.length >= MIN_CONTENT_LENGTH) {
        // Apply local privacy filter
        const filtered = window.__continuumFilterPII
          ? window.__continuumFilterPII(text, state.privacyRules?.blocked_keywords || [])
          : text;

        messageBuffer.push({
          role: role,
          content: filtered,
          timestamp: new Date().toISOString(),
        });
      }
    }

    lastCapturedIndex = messages.length;
  }

  // ─── Batch sending ────────────────────────────────────────────────
  function startBatchTimer() {
    batchTimer = setInterval(flushBuffer, BATCH_INTERVAL_MS);

    // Also flush on page unload
    window.addEventListener('beforeunload', flushBuffer);
  }

  function flushBuffer() {
    if (messageBuffer.length === 0) return;

    const content = messageBuffer
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n---\n\n');

    chrome.runtime.sendMessage({
      type: 'CAPTURE_CONTENT',
      payload: {
        source_type: SOURCE_TYPE,
        source_name: SOURCE_NAME,
        url: window.location.href,
        title: document.title,
        content: content,
      },
    });

    console.log(`[Continuum] Sent ${messageBuffer.length} messages from ChatGPT`);
    messageBuffer = [];
  }

  // ─── Cleanup ──────────────────────────────────────────────────────
  function cleanup() {
    if (observer) observer.disconnect();
    if (batchTimer) clearInterval(batchTimer);
    flushBuffer(); // Send any remaining
  }

  // ─── Start ────────────────────────────────────────────────────────
  // Wait for page to be ready
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
