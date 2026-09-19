// Continuum — Auto-RAG Interceptor
// Intercepts chat submissions on Web LLMs, fetches context, and prepends it.

(function () {
  'use strict';

  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log('[Continuum Interceptor]', ...args);
  }

  let state = null;
  let isIntercepting = false;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (!state.activeProject) {
      log('No active project. Interceptor disabled.');
      return;
    }
    log(`Active for project: ${state.activeProject.name}`);
    attachListeners();
  }

  function getChatInputElements() {
    const hostname = window.location.hostname;
    
    // Selectors for the input box and the submit button
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
    // We use a global listener because SPAs constantly destroy/recreate elements
    document.addEventListener('keydown', handleKeydown, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });
    log('Listeners attached');
  }

  async function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      const { inputEl } = getChatInputElements();
      if (inputEl && (e.target === inputEl || inputEl.contains(e.target))) {
        await processSubmit(e, inputEl);
      }
    }
  }

  async function handleClick(e) {
    const { buttonEl, inputEl } = getChatInputElements();
    if (buttonEl && (e.target === buttonEl || buttonEl.contains(e.target))) {
      await processSubmit(e, inputEl);
    }
  }

  async function processSubmit(event, inputEl) {
    if (isIntercepting || !inputEl) return;

    let userText = '';
    if (inputEl.tagName === 'TEXTAREA') {
      userText = inputEl.value;
    } else {
      userText = inputEl.innerText;
    }
    userText = userText.trim();

    if (!userText) return;

    // Stop the original submit
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    isIntercepting = true;
    log('Intercepted submit for:', userText);

    // Show a loading state to the user
    showLoadingIndicator(inputEl);

    try {
      // Search backend for context
      const response = await chrome.runtime.sendMessage({ 
        type: 'SEARCH_CONTEXT', 
        query: userText 
      });

      removeLoadingIndicator();

      if (response.results && response.results.length > 0) {
        log(`Found ${response.results.length} context entries`);
        
        // Format the results
        const contextLines = response.results.map(r => 
          `- [${r.source_name}]: ${r.summary_text}`
        );
        const contextStr = `[Continuum Auto-Context]\n${contextLines.join('\n')}\n\n---\nUser Message:\n`;
        
        // Prepend to input using browser editing commands to trigger framework events natively
        inputEl.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, contextStr + userText);
        
        // Dispatch React-compatible input events as a fallback for standard inputs
        if (inputEl.tagName === 'TEXTAREA') {
          dispatchReactEvent(inputEl);
        }
      } else {
        log('No relevant context found.');
      }
    } catch (err) {
      console.error('[Continuum Interceptor] Search failed:', err);
      removeLoadingIndicator();
    }

    // Trigger the actual submit after a tiny delay so React updates state
    setTimeout(() => {
      triggerSubmit(inputEl);
      setTimeout(() => { isIntercepting = false; }, 500);
    }, 50);
  }

  function dispatchReactEvent(element) {
    const event = new Event('input', { bubbles: true });
    // React 16+ overrides the default setter, so we need to get the original
    let tracker = element._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }
    element.dispatchEvent(event);
  }

  function triggerSubmit(inputEl) {
    log('Triggering actual submit');
    const { buttonEl } = getChatInputElements();
    
    // Simulate Enter key
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
    
    // Fallback: click the button
    if (buttonEl) {
      buttonEl.click();
    }
  }

  // UI Helpers
  let loadingBadge = null;
  function showLoadingIndicator(inputEl) {
    if (loadingBadge) return;
    loadingBadge = document.createElement('div');
    loadingBadge.id = 'continuum-loading-badge';
    loadingBadge.innerHTML = '🔄 Searching Continuum Memory...';
    loadingBadge.style.cssText = `
      position: absolute;
      top: -30px;
      left: 10px;
      background: #6c63ff;
      color: white;
      padding: 4px 10px;
      border-radius: 10px;
      font-size: 12px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    const container = inputEl.parentElement;
    if (container) {
      container.style.position = 'relative';
      container.appendChild(loadingBadge);
    }
  }

  function removeLoadingIndicator() {
    if (loadingBadge) {
      loadingBadge.remove();
      loadingBadge = null;
    }
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
