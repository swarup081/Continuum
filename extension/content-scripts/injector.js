// Continuum — Context Primer Injector
// Injects context primer into LLM chat input boxes on new conversations

(function () {
  'use strict';

  const INJECTION_CHECK_INTERVAL = 2000; // Check every 2s for new chat
  const INJECTED_FLAG = '__continuum_injected';

  let state = null;
  let lastUrl = window.location.href;
  let injectionTimer = null;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state.activeProject || !state.captureEnabled) {
      console.log('[Continuum] Injector: No active project');
      return;
    }

    console.log('[Continuum] Injector active for:', state.activeProject.name);

    // Watch for URL changes (new chat in SPA)
    injectionTimer = setInterval(checkForNewChat, INJECTION_CHECK_INTERVAL);

    // Initial check
    checkForNewChat();
  }

  function checkForNewChat() {
    const currentUrl = window.location.href;

    // Detect URL change (new chat)
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Reset injection flag on URL change
      document.body.removeAttribute(INJECTED_FLAG);
    }

    // Don't inject if already done for this page
    if (document.body.hasAttribute(INJECTED_FLAG)) return;

    // Check if this looks like a new/empty chat
    if (isNewChat()) {
      injectPrimer();
    }
  }

  function isNewChat() {
    const hostname = window.location.hostname;

    if (hostname.includes('chatgpt.com')) {
      // ChatGPT: new chat has no conversation turns
      const messages = document.querySelectorAll('[data-message-author-role]');
      return messages.length === 0;
    }

    if (hostname.includes('gemini.google.com')) {
      // Gemini: new chat has no message content
      const messages = document.querySelectorAll('message-content, model-response');
      return messages.length === 0;
    }

    if (hostname.includes('claude.ai')) {
      // Claude: new chat has no messages in the conversation
      const messages = document.querySelectorAll('[data-testid*="message"], .font-claude-message');
      return messages.length === 0;
    }

    return false;
  }

  async function injectPrimer() {
    // Fetch primer from backend
    const response = await chrome.runtime.sendMessage({ type: 'GET_PRIMER' });

    if (!response.primer) {
      console.log('[Continuum] No primer available');
      return;
    }

    const inputBox = findInputBox();
    if (!inputBox) {
      console.log('[Continuum] Input box not found');
      return;
    }

    // Inject the primer text
    const primerText = response.primer + '\n\n---\n\n';

    if (inputBox.tagName === 'TEXTAREA') {
      inputBox.value = primerText;
      inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (inputBox.contentEditable === 'true') {
      // For contenteditable divs (Claude, Gemini)
      inputBox.innerHTML = `<p>${primerText.replace(/\n/g, '<br>')}</p>`;
      inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Mark as injected
    document.body.setAttribute(INJECTED_FLAG, 'true');

    // Show a subtle indicator
    showInjectionBadge(inputBox);

    console.log('[Continuum] Primer injected for project:', state.activeProject.name);
  }

  function findInputBox() {
    const hostname = window.location.hostname;

    // Site-specific selectors
    const selectors = {
      'chatgpt.com': ['#prompt-textarea', 'textarea[data-id]', 'textarea'],
      'gemini.google.com': ['.ql-editor', 'rich-textarea .ql-editor', '[contenteditable="true"]'],
      'claude.ai': ['div[contenteditable="true"].ProseMirror', '[contenteditable="true"]'],
    };

    for (const [domain, selectorList] of Object.entries(selectors)) {
      if (hostname.includes(domain)) {
        for (const selector of selectorList) {
          const el = document.querySelector(selector);
          if (el) return el;
        }
      }
    }

    // Generic fallback
    return document.querySelector('textarea, [contenteditable="true"]');
  }

  function showInjectionBadge(nearElement) {
    // Create a small badge to indicate context was loaded
    const badge = document.createElement('div');
    badge.id = 'continuum-injection-badge';
    badge.innerHTML = '🔄 Continuum context loaded';
    badge.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: linear-gradient(135deg, #6c63ff, #3f3d9e);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(108, 99, 255, 0.4);
      transition: opacity 0.5s ease;
      pointer-events: none;
    `;

    document.body.appendChild(badge);

    // Fade out and remove after 4 seconds
    setTimeout(() => {
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 500);
    }, 4000);
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
