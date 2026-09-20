// Continuum - Context Primer Injector
// Injects project context into LLM chat input boxes (ChatGPT, Gemini, Claude)
// Provides auto-injection on new chats AND an on-demand floating "Inject Context" button.

(function () {
  'use strict';

  const INJECTION_CHECK_INTERVAL = 1500;
  const INJECTED_FLAG = '__continuum_injected';
  const BUTTON_ID = 'continuum-inject-btn';

  let state = null;
  let lastUrl = window.location.href;
  let checkTimer = null;

  async function init() {
    try {
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    } catch (e) {
      return;
    }

    if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) {
      removeInjectButton();
      return;
    }

    // Periodically check for URL change (new chat) and ensure inject button is present
    checkTimer = setInterval(tick, INJECTION_CHECK_INTERVAL);
    tick();

    // Listen for storage changes (e.g. if user toggles capture or switches project in popup)
    chrome.storage.onChanged.addListener(async () => {
      try {
        state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) {
          removeInjectButton();
        } else {
          ensureInjectButton();
        }
      } catch (e) {}
    });
  }

  function tick() {
    if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) {
      removeInjectButton();
      return;
    }

    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      document.body.removeAttribute(INJECTED_FLAG);
    }

    ensureInjectButton();

    // If new chat and not yet injected, auto-inject
    if (!document.body.hasAttribute(INJECTED_FLAG) && isNewChat()) {
      autoInjectPrimer();
    }
  }

  function isNewChat() {
    const hostname = window.location.hostname;

    if (hostname.includes('chatgpt.com')) {
      const msgs = document.querySelectorAll('[data-message-author-role]');
      return msgs.length === 0;
    }

    if (hostname.includes('gemini.google.com')) {
      const msgs = document.querySelectorAll('user-query, model-response, message-content, .query-content');
      return msgs.length === 0;
    }

    if (hostname.includes('claude.ai')) {
      const msgs = document.querySelectorAll('[data-testid*="message"], .font-claude-message');
      return msgs.length === 0;
    }

    return false;
  }

  function findInputBox() {
    const hostname = window.location.hostname;

    const selectors = {
      'chatgpt.com': ['#prompt-textarea', 'textarea[data-id]', 'textarea', 'div[contenteditable="true"]#prompt-textarea'],
      'gemini.google.com': ['.ql-editor', 'rich-textarea .ql-editor', 'rich-textarea [contenteditable="true"]', '[contenteditable="true"]'],
      'claude.ai': ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
    };

    for (const [domain, selectorList] of Object.entries(selectors)) {
      if (hostname.includes(domain)) {
        for (const sel of selectorList) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return el;
        }
      }
    }

    return document.querySelector('textarea, [contenteditable="true"]');
  }

  function setInputValue(inputEl, text) {
    if (!inputEl) return;
    inputEl.focus();

    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(inputEl, text);
      } else {
        inputEl.value = text;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // contenteditable / Quill / ProseMirror
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
      } catch (e) {}

      // Fallback if execCommand did not change text
      const current = inputEl.innerText || '';
      if (!current.includes(text.slice(0, 15))) {
        const cleanLines = text.split('\n');
        inputEl.innerHTML = cleanLines.map(l => '<p>' + (l ? escapeHtml(l) : '<br>') + '</p>').join('');
      }

      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function autoInjectPrimer() {
    const inputBox = findInputBox();
    if (!inputBox) return;

    // Don't overwrite if user has already started typing
    const currentVal = (inputBox.tagName === 'TEXTAREA' ? inputBox.value : inputBox.innerText) || '';
    if (currentVal.trim().length > 0) return;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PRIMER' });
      if (!response || !response.primer || response.primer.trim() === '') {
        return; // Don't mark as injected yet if empty, retry on next turn
      }

      setInputValue(inputBox, response.primer + '\n\n---\n\n');
      document.body.setAttribute(INJECTED_FLAG, 'true');
      showToast('Continuum context loaded');
    } catch (err) {
      console.error('[Continuum] Auto-inject failed:', err);
    }
  }

  async function manualInject() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.textContent = 'Injecting...';
      btn.disabled = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PRIMER' });
      const inputBox = findInputBox();

      if (!inputBox) {
        showToast('Chat input box not found', true);
        return;
      }

      if (!response || !response.primer || response.primer.trim() === '') {
        showToast('No saved context found for ' + state.activeProject.name, true);
        return;
      }

      const existingText = (inputBox.tagName === 'TEXTAREA' ? inputBox.value : inputBox.innerText) || '';
      const textToInject = existingText.trim()
        ? response.primer + '\n\n---\n\n' + existingText.trim()
        : response.primer + '\n\n---\n\n';

      setInputValue(inputBox, textToInject);
      showToast('Injected ' + state.activeProject.name + ' context!');
    } catch (err) {
      showToast('Failed to inject context', true);
    } finally {
      if (btn) {
        btn.textContent = '✦ Inject ' + (state.activeProject ? state.activeProject.name : 'Context');
        btn.disabled = false;
      }
    }
  }

  function ensureInjectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    if (!state || !state.activeProject || !state.captureEnabled) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.textContent = '✦ Inject ' + state.activeProject.name;
    btn.title = 'Click to inject relevant project context into this chat';
    btn.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'background: linear-gradient(135deg, #6c63ff 0%, #4a42d9 100%)',
      'color: #ffffff',
      'border: none',
      'border-radius: 20px',
      'padding: 8px 16px',
      'font-size: 13px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-weight: 600',
      'cursor: pointer',
      'z-index: 99999',
      'box-shadow: 0 4px 14px rgba(108, 99, 255, 0.4)',
      'transition: all 0.2s ease',
      'display: flex',
      'align-items: center',
      'gap: 6px',
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 18px rgba(108, 99, 255, 0.55)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 14px rgba(108, 99, 255, 0.4)';
    });
    btn.addEventListener('click', manualInject);

    document.body.appendChild(btn);
  }

  function removeInjectButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
  }

  function showToast(message, isError = false) {
    const existing = document.getElementById('continuum-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'continuum-toast';
    toast.textContent = message;
    toast.style.cssText = [
      'position: fixed',
      'bottom: 74px',
      'right: 24px',
      'background: ' + (isError ? '#ef4444' : '#10b981'),
      'color: white',
      'padding: 8px 14px',
      'border-radius: 8px',
      'font-size: 12px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-weight: 500',
      'z-index: 999999',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.2)',
      'transition: opacity 0.3s ease',
      'pointer-events: none',
    ].join(';');

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();