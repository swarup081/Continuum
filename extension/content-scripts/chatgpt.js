// Continuum — ChatGPT Content Script
// Captures conversation content from chatgpt.com using a Debounced MutationObserver

(function () {
  'use strict';

  const SOURCE_NAME = 'ChatGPT';
  const SOURCE_TYPE = 'llm_chat';
  const DEBOUNCE_MS = 3000;        // Wait 3s after LLM stops typing to flush
  const MIN_CONTENT_LENGTH = 50;   // Don't capture tiny fragments
  const HISTORY_WINDOW = 3;        // Number of previous messages to include for context

  let lastCapturedIndex = 0;
  let observer = null;
  let flushTimer = null;
  let state = null;

  // ─── Initialize ─────────────────────────────────────────────────
  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state.activeProject || !state.captureEnabled || state.isBlocked) {
      console.log('[Continuum] ChatGPT capture inactive');
      return;
    }

    console.log('[Continuum] ChatGPT capture active for project:', state.activeProject.name);
    startObserving();
    
    // Also flush on page unload to catch any pending messages
    window.addEventListener('beforeunload', () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushBuffer();
      }
    });
  }

  // ─── DOM Observation ──────────────────────────────────────────────
  function startObserving() {
    const targetNode = document.querySelector('main') || document.body;

    observer = new MutationObserver((mutations) => {
      let shouldDebounce = false;
      for (const mutation of mutations) {
        // Ignore mutations happening inside the chat input area so user typing doesn't block flushing
        if (mutation.target.tagName === 'TEXTAREA' || mutation.target.isContentEditable || mutation.target.id === 'prompt-textarea') {
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
      characterData: true // Important for capturing streaming text updates
    });
  }

  function triggerDebouncedFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushBuffer, DEBOUNCE_MS);
  }

  // ─── Extraction and Flushing ──────────────────────────────────────
  function flushBuffer() {
    // 1. Find all messages in the DOM
    const messageSelectors = [
      '[data-message-author-role]',        
      '.markdown',                          
      '[data-testid*="conversation-turn"]', 
    ];

    let messages = [];
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        break;
      }
    }

    // 2. Determine what's new and what's history
    if (messages.length <= lastCapturedIndex) return; // Nothing new

    const newElements = messages.slice(lastCapturedIndex);
    const historyElements = messages.slice(Math.max(0, lastCapturedIndex - HISTORY_WINDOW), lastCapturedIndex);

    // 3. Process elements into text
    const processElement = (msg) => {
      const role = msg.getAttribute('data-message-author-role') || 'unknown';
      let text = msg.innerText?.trim();
      
      if (!text) return null;

      // Apply privacy filter
      const filtered = window.__continuumFilterPII
        ? window.__continuumFilterPII(text, state.privacyRules?.blocked_keywords || [])
        : text;
        
      return `[${role}]: ${filtered}`;
    };

    const newTexts = newElements.map(processElement).filter(t => t && t.length >= MIN_CONTENT_LENGTH);
    const historyTexts = historyElements.map(processElement).filter(t => t);

    console.log(`[Continuum Debug] Flush triggered. Total messages found: ${messages.length}`);
    console.log(`[Continuum Debug] New elements since last capture: ${newElements.length}`);
    console.log(`[Continuum Debug] Texts passing length filter (>= 50 chars): ${newTexts.length}`);

    if (newTexts.length === 0) {
      console.log('[Continuum Debug] Aborting flush: No new messages are long enough (>= 50 chars). Try typing a much longer message!');
      lastCapturedIndex = messages.length;
      return;
    }

    // 4. Construct payload with Sliding Window History
    let finalContent = '';
    
    if (historyTexts.length > 0) {
      finalContent += `[Context History]\n${historyTexts.join('\n\n')}\n\n---\n\n`;
    }
    
    finalContent += `[New Conversation]\n${newTexts.join('\n\n')}`;

    // 5. Send to Backend
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

  // ─── Start ────────────────────────────────────────────────────────
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
