// Continuum — Gemini Content Script
// Captures conversation content from gemini.google.com using MutationObserver

(function () {
  'use strict';

  const SOURCE_NAME = 'Gemini';
  const SOURCE_TYPE = 'llm_chat';
  const BATCH_INTERVAL_MS = 15000;
  const MIN_CONTENT_LENGTH = 50;

  let messageBuffer = [];
  let lastCapturedIndex = 0;
  let observer = null;
  let batchTimer = null;
  let state = null;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state.activeProject || !state.captureEnabled || state.isBlocked) {
      console.log('[Continuum] Gemini capture inactive');
      return;
    }

    console.log('[Continuum] Gemini capture active for project:', state.activeProject.name);
    startObserving();
    startBatchTimer();
  }

  function startObserving() {
    const targetNode = document.querySelector('main') || document.body;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          extractNewMessages();
        }
      }
    });

    observer.observe(targetNode, { childList: true, subtree: true });
    extractNewMessages();
  }

  function extractNewMessages() {
    // Gemini message selectors (may change — update as needed)
    const messageSelectors = [
      'message-content',                    // Gemini message component
      '.response-container',                // AI response blocks
      '.user-query',                        // User query blocks
      '.conversation-container .message',   // Generic fallback
      'model-response',                     // Model response element
      'user-query',                         // User query element
    ];

    let messages = [];
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        break;
      }
    }

    const newMessages = messages.slice(lastCapturedIndex);

    for (const msg of newMessages) {
      // Try to determine role from element tag or class
      const tagName = msg.tagName?.toLowerCase() || '';
      const className = msg.className?.toLowerCase() || '';
      let role = 'unknown';
      if (tagName.includes('user') || className.includes('user') || className.includes('query')) {
        role = 'user';
      } else if (tagName.includes('model') || className.includes('response') || className.includes('model')) {
        role = 'assistant';
      }

      const text = msg.innerText?.trim();

      if (text && text.length >= MIN_CONTENT_LENGTH) {
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

  function startBatchTimer() {
    batchTimer = setInterval(flushBuffer, BATCH_INTERVAL_MS);
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

    console.log(`[Continuum] Sent ${messageBuffer.length} messages from Gemini`);
    messageBuffer = [];
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
