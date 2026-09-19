// Continuum — Generic Webpage Content Script
// Extracts main content from any webpage (non-LLM sites)

(function () {
  'use strict';

  const SOURCE_TYPE = 'webpage';
  const MAX_CONTENT_LENGTH = 10000;
  const MIN_CONTENT_LENGTH = 200; // Don't capture nearly-empty pages
  const CAPTURE_DELAY_MS = 3000;  // Wait for dynamic content to load

  let state = null;

  async function init() {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (!state.activeProject || !state.captureEnabled || state.isBlocked) {
      return;
    }

    // Inject the manual "Save" button
    injectFloatingButton();
  }

  function injectFloatingButton() {
    const btn = document.createElement('button');
    btn.id = 'continuum-manual-save-btn';
    btn.innerHTML = `📌 Save to ${state.activeProject.name}`;
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #6c63ff;
      color: white;
      border: none;
      border-radius: 24px;
      padding: 10px 20px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(108, 99, 255, 0.4);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 16px rgba(108, 99, 255, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 12px rgba(108, 99, 255, 0.4)';
    });

    btn.addEventListener('click', async () => {
      btn.innerHTML = `⏳ Saving...`;
      btn.style.background = '#3f3d9e';
      btn.disabled = true;

      const success = await capturePageContent();

      if (success) {
        btn.innerHTML = `✅ Saved to ${state.activeProject.name}`;
        btn.style.background = '#4caf50';
        setTimeout(() => {
          btn.style.opacity = '0';
          setTimeout(() => btn.remove(), 500);
        }, 3000);
      } else {
        btn.innerHTML = `❌ Failed to save (too short)`;
        btn.style.background = '#f44336';
        setTimeout(() => {
          btn.innerHTML = `📌 Save to ${state.activeProject.name}`;
          btn.style.background = '#6c63ff';
          btn.disabled = false;
        }, 3000);
      }
    });

    document.body.appendChild(btn);
  }

  async function capturePageContent() {
    const content = extractMainContent();

    if (!content || content.length < MIN_CONTENT_LENGTH) {
      console.log('[Continuum] Page too short to capture:', window.location.href);
      return false;
    }

    // Apply privacy filter
    const filtered = window.__continuumFilterPII
      ? window.__continuumFilterPII(content, state.privacyRules?.blocked_keywords || [])
      : content;

    const hostname = window.location.hostname;

    chrome.runtime.sendMessage({
      type: 'CAPTURE_CONTENT',
      payload: {
        source_type: SOURCE_TYPE,
        source_name: hostname,
        url: window.location.href,
        title: document.title,
        content: filtered.substring(0, MAX_CONTENT_LENGTH),
      },
    });

    console.log(`[Continuum] Captured webpage: ${hostname} (${filtered.length} chars)`);
    return true;
  }

  /**
   * Extract the main readable content from a page.
   * Uses a priority-based heuristic approach.
   */
  function extractMainContent() {
    // Strategy 1: Look for <article> tag
    const article = document.querySelector('article');
    if (article) {
      const text = cleanText(article.innerText);
      if (text.length >= MIN_CONTENT_LENGTH) return text;
    }

    // Strategy 2: Look for <main> tag
    const main = document.querySelector('main');
    if (main) {
      const text = cleanText(main.innerText);
      if (text.length >= MIN_CONTENT_LENGTH) return text;
    }

    // Strategy 3: Look for common content containers
    const contentSelectors = [
      '[role="main"]',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '#main-content',
      '.page-content',
    ];

    for (const selector of contentSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = cleanText(el.innerText);
        if (text.length >= MIN_CONTENT_LENGTH) return text;
      }
    }

    // Strategy 4: Find the largest text block (most paragraphs)
    const containers = document.querySelectorAll('div, section');
    let bestContainer = null;
    let bestScore = 0;

    for (const container of containers) {
      const paragraphs = container.querySelectorAll('p');
      const textLength = container.innerText?.length || 0;
      const score = paragraphs.length * 100 + textLength;

      if (score > bestScore && textLength >= MIN_CONTENT_LENGTH) {
        bestScore = score;
        bestContainer = container;
      }
    }

    if (bestContainer) {
      return cleanText(bestContainer.innerText);
    }

    // Strategy 5: Fall back to body text (truncated)
    return cleanText(document.body.innerText);
  }

  /**
   * Clean extracted text: remove excess whitespace, nav elements, etc.
   */
  function cleanText(text) {
    if (!text) return '';

    return text
      .replace(/\n{3,}/g, '\n\n')          // Collapse multiple newlines
      .replace(/\t+/g, ' ')                 // Replace tabs with spaces
      .replace(/ {3,}/g, ' ')               // Collapse multiple spaces
      .replace(/^\s+$/gm, '')               // Remove blank lines
      .trim();
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
