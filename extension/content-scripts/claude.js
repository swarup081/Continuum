// Continuum - Claude Content Script
// Captures conversation content using stable-text polling

(function () {
  'use strict';

  const SOURCE_NAME = 'Claude';
  const SOURCE_TYPE = 'llm_chat';
  let state = null;
  let lastCapturedText = '';
  let lastSeenText = '';
  let stableCount = 0;
  let captureInterval = null;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (!state.activeProject || !state.captureEnabled || state.isBlocked) return;
    captureInterval = setInterval(pollAndCapture, 2000);
    window.addEventListener('beforeunload', forceCapture);
  }

  function extractText() {
    const elements = document.querySelectorAll('.font-claude-message, [data-testid*="message"]');
    if (elements.length === 0) return '';

    const parts = [];
    for (const el of elements) {
      let text = el.innerText;
      if (!text) continue;
      text = text.trim();
      if (!text) continue;

      const attr = el.getAttribute('data-testid') || '';
      const role = attr.includes('user') ? 'user' : 'assistant';

      const filtered = window.__continuumFilterPII
        ? window.__continuumFilterPII(text, state.privacyRules?.blocked_keywords || [])
        : text;
      parts.push('[' + role + ']: ' + filtered);
    }
    return parts.slice(-10).join('\n\n');
  }

  function pollAndCapture() {
    const currentText = extractText();
    if (!currentText || currentText.length < 50) return;

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
    if (currentText && currentText.length >= 50 && currentText !== lastCapturedText) {
      doCapture(currentText);
    }
  }

  function doCapture(text) {
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
