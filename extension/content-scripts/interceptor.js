// Continuum - Auto-RAG Interceptor
// Intercepts chat submissions on Web LLMs, fetches relevant context, and prepends it.

(function () {
  'use strict';

  const DEBUG = false;
  function log(...args) {
    if (DEBUG) console.log('[Continuum Interceptor]', ...args);
  }

  let state = null;
  let isIntercepting = false;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (!state.activeProject || !state.captureEnabled) {
      log('No active project or capture disabled. Interceptor off.');
      return;
    }
    log('Active for project: ' + state.activeProject.name);
    attachListeners();
  }

  function getChatInputElements() {
    const hostname = window.location.hostname;

    const selectors = {
      'chatgpt.com': {
        input: ['#prompt-textarea', 'textarea[data-id]'],
        button: ['button[data-testid="send-button"]']
      },
      'gemini.google.com': {
        input: ['.ql-editor', 'rich-textarea .ql-editor', '[contenteditable="true"]'],
        button: ['.send-button', 'button[aria-label*="Send"]']
      },
      'claude.ai': {
        input: ['div[contenteditable="true"].ProseMirror'],
        button: ['button[aria-label="Send Message"]']
      },
    };

    let domainSelectors = { input: ['textarea', '[contenteditable="true"]'], button: ['button[type="submit"]'] };
    for (const [domain, config] of Object.entries(selectors)) {
      if (hostname.includes(domain)) {
        domainSelectors = config;
        break;
      }
    }

    let inputEl = null;
    let buttonEl = null;

    for (const sel of domainSelectors.input) {
      const el = document.querySelector(sel);
      if (el) { inputEl = el; break; }
    }
    for (const sel of domainSelectors.button) {
      const el = document.querySelector(sel);
      if (el) { buttonEl = el; break; }
    }

    return { inputEl, buttonEl };
  }

  function attachListeners() {
    document.addEventListener('keydown', handleKeydown, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });
    log('Listeners attached');
  }

  async function handleKeydown(e) {
    if (isIntercepting) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      const { inputEl } = getChatInputElements();
      if (inputEl && (e.target === inputEl || inputEl.contains(e.target))) {
        await processSubmit(e, inputEl);
      }
    }
  }

  async function handleClick(e) {
    if (isIntercepting) return;
    const { buttonEl, inputEl } = getChatInputElements();
    if (buttonEl && (e.target === buttonEl || buttonEl.contains(e.target))) {
      await processSubmit(e, inputEl);
    }
  }

  async function processSubmit(event, inputEl) {
    if (!inputEl) return;

    let userText = '';
    if (inputEl.tagName === 'TEXTAREA') {
      userText = inputEl.value;
    } else {
      userText = inputEl.innerText;
    }
    userText = userText.trim();

    if (!userText) return;

    // Block the original event
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    isIntercepting = true;
    log('Intercepted submit for: ' + userText);

    try {
      // Search backend for relevant context
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_CONTEXT',
        query: userText
      });

      if (response.results && response.results.length > 0) {
        log('Found ' + response.results.length + ' context entries');

        const contextLines = response.results.map(function(r) {
          return '- [' + r.source_name + ']: ' + r.summary_text;
        });
        const contextStr = '[Continuum Auto-Context]\n' + contextLines.join('\n') + '\n\n---\nUser Message:\n';

        // Prepend context to the user text
        inputEl.focus();
        if (inputEl.tagName === 'TEXTAREA') {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          ).set;
          nativeSetter.call(inputEl, contextStr + userText);
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // contenteditable
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, contextStr + userText);
        }
      } else {
        log('No relevant context found.');
      }
    } catch (err) {
      console.error('[Continuum Interceptor] Search failed:', err);
    }

    // Trigger the actual submit ONCE after a tiny delay
    setTimeout(function() {
      const { buttonEl } = getChatInputElements();
      if (buttonEl) {
        buttonEl.click();
      } else {
        // Fallback: simulate Enter
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true
        });
        inputEl.dispatchEvent(enterEvent);
      }
      // Reset the guard after a generous delay
      setTimeout(function() { isIntercepting = false; }, 2000);
    }, 100);
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
