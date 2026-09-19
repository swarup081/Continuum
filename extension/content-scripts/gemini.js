// Continuum — Gemini Content Script
// Captures conversation content from gemini.google.com using a Debounced MutationObserver

(function () {
  'use strict';

  const SOURCE_NAME = 'Gemini';
  const SOURCE_TYPE = 'llm_chat';
  const DEBOUNCE_MS = 3000;
  const MIN_CONTENT_LENGTH = 50;
  const HISTORY_WINDOW = 3;

  let lastCapturedIndex = 0;
  let observer = null;
  let flushTimer = null;
  let state = null;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state.activeProject || !state.captureEnabled || state.isBlocked) {
      console.log('[Continuum] Gemini capture inactive');
      return;
    }

    console.log('[Continuum] Gemini capture active for project:', state.activeProject.name);
    startObserving();
    
    window.addEventListener('beforeunload', () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushBuffer();
      }
    });
  }

  function startObserving() {
    const targetNode = document.querySelector('main') || document.body;

    observer = new MutationObserver((mutations) => {
      let shouldDebounce = false;
      for (const mutation of mutations) {
        // Ignore mutations in Gemini's contenteditable inputs
        if (mutation.target.isContentEditable || mutation.target.classList?.contains('ql-editor')) {
          continue;
        }
        shouldDebounce = true;
      }

      if (shouldDebounce) {
        triggerDebouncedFlush();
      }
    });

    observer.observe(targetNode, { 
      childList: true, 
      subtree: true,
      characterData: true
    });
  }

  function triggerDebouncedFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushBuffer, DEBOUNCE_MS);
  }

  function flushBuffer() {
    const messageSelectors = [
      'message-content',                    
      '.response-container',                
      '.user-query',                        
      '.conversation-container .message',   
      'model-response',                     
      'user-query',                         
    ];

    let messages = [];
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        break;
      }
    }

    if (messages.length <= lastCapturedIndex) return;

    const newElements = messages.slice(lastCapturedIndex);
    const historyElements = messages.slice(Math.max(0, lastCapturedIndex - HISTORY_WINDOW), lastCapturedIndex);

    const processElement = (msg) => {
      const tagName = msg.tagName?.toLowerCase() || '';
      const className = msg.className?.toLowerCase() || '';
      let role = 'unknown';
      if (tagName.includes('user') || className.includes('user') || className.includes('query')) {
        role = 'user';
      } else if (tagName.includes('model') || className.includes('response') || className.includes('model')) {
        role = 'assistant';
      }

      const text = msg.innerText?.trim();
      
      if (!text) return null;

      const filtered = window.__continuumFilterPII
        ? window.__continuumFilterPII(text, state.privacyRules?.blocked_keywords || [])
        : text;

      return `[${role}]: ${filtered}`;
    };

    const newTexts = newElements.map(processElement).filter(t => t && t.length >= MIN_CONTENT_LENGTH);
    const historyTexts = historyElements.map(processElement).filter(t => t);

    if (newTexts.length === 0) {
      lastCapturedIndex = messages.length;
      return;
    }

    let finalContent = '';
    
    if (historyTexts.length > 0) {
      finalContent += `[Context History]\n${historyTexts.join('\n\n')}\n\n---\n\n`;
    }
    
    finalContent += `[New Conversation]\n${newTexts.join('\n\n')}`;

    chrome.runtime.sendMessage({
      type: 'CAPTURE_CONTENT',
      payload: {
        source_type: SOURCE_TYPE,
        source_name: SOURCE_NAME,
        url: window.location.href,
        title: document.title,
        content: finalContent,
      },
    });

    console.log(`[Continuum] Flushed ${newTexts.length} new messages (+${historyTexts.length} history)`);
    lastCapturedIndex = messages.length;
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
