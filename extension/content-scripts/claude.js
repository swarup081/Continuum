// Continuum - Claude Content Script
// Captures conversation content continuously using polling and DOM observer

(function () {
  'use strict';

  const SOURCE_NAME = 'Claude';
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

    if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) return;

    captureInterval = setInterval(pollAndCapture, 2000);
    setupObserver();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') forceCapture();
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
    const elements = document.querySelectorAll('.font-claude-message, [data-testid*="message"], [data-testid*="chat-message"]');
    if (elements.length === 0) return '';

    const parts = [];
    for (const el of elements) {
      let text = el.innerText;
      if (!text) continue;
      text = text.trim();
      if (!text || text.length < 2) continue;

      const attr = el.getAttribute('data-testid') || '';
      const isUser = attr.includes('user') || el.querySelector('[data-testid*="user"]');
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
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();