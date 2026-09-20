// Continuum - Gemini Content Script
// Captures conversation content continuously using robust polling and DOM observer

(function () {
  'use strict';

  const SOURCE_NAME = 'Gemini';
  const SOURCE_TYPE = 'llm_chat';
  let state = null;
  let lastCapturedText = '';
  let lastSeenText = '';
  let stableCount = 0;
  let captureInterval = null;
  let observer = null;

  async function init() {
    try {
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    } catch (e) {
      return;
    }

    if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) {
      console.log('[Continuum Gemini] Capture inactive');
      return;
    }

    console.log('[Continuum Gemini] Capture active for:', state.activeProject.name);

    // Poll every 2 seconds for text stabilization
    captureInterval = setInterval(pollAndCapture, 2000);

    // Watch for DOM mutations in conversation
    setupObserver();

    // Capture immediately if leaving the page or tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        forceCapture();
      }
    });
    window.addEventListener('beforeunload', forceCapture);
  }

  function setupObserver() {
    try {
      observer = new MutationObserver(() => {
        pollAndCapture();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  function extractText() {
    // Select all user queries and model responses across Gemini DOM variations
    const querySelectors = 'user-query, .user-query, .query-content, [data-message-author="user"], .user-prompt-text';
    const responseSelectors = 'model-response, message-content, .model-response-text, .response-container-content, [data-message-author="model"], .response-content, .markdown';

    const allMatches = Array.from(document.querySelectorAll(`${querySelectors}, ${responseSelectors}`));
    if (allMatches.length === 0) return '';

    // Filter out nested matches so we don't duplicate inner text
    const elements = allMatches.filter(el => !allMatches.some(other => other !== el && other.contains(el)));

    const parts = [];
    for (const el of elements) {
      let text = el.innerText;
      if (!text) continue;
      text = text.trim();
      if (!text || text.length < 2) continue;

      const tag = el.tagName.toLowerCase();
      const className = el.className || '';
      const author = el.getAttribute('data-message-author') || '';

      const isUser = tag.includes('user') || className.includes('user') || className.includes('query') || author === 'user';
      const role = isUser ? 'user' : 'assistant';

      const filtered = window.__continuumFilterPII
        ? window.__continuumFilterPII(text, state.privacyRules?.blocked_keywords || [])
        : text;

      parts.push(`[${role}]: ${filtered}`);
    }

    return parts.slice(-10).join('\n\n');
  }

  function pollAndCapture() {
    const currentText = extractText();
    if (!currentText || currentText.length < 30) return;

    if (currentText === lastSeenText) {
      stableCount++;
      // Once text is stable for 2 intervals and changed since last capture
      if (stableCount >= 2 && currentText !== lastCapturedText) {
        doCapture(currentText);
        lastCapturedText = currentText;
      }
    } else {
      lastSeenText = currentText;
      stableCount = 0;
    }
  }

  function forceCapture() {
    const currentText = extractText();
    if (currentText && currentText.length >= 30 && currentText !== lastCapturedText) {
      doCapture(currentText);
      lastCapturedText = currentText;
    }
  }

  function doCapture(text) {
    if (!state || !state.activeProject || !state.captureEnabled) return;
    chrome.runtime.sendMessage({
      type: 'CAPTURE_CONTENT',
      payload: {
        source_type: SOURCE_TYPE,
        source_name: SOURCE_NAME,
        url: window.location.href,
        title: document.title,
        content: '[New Conversation]\n' + text,
      },
    });
    console.log('[Continuum Gemini] Captured conversation content (' + text.length + ' chars)');
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();