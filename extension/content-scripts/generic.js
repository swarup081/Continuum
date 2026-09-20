// Continuum - Generic Webpage Content Script
// Extracts main content from any webpage (non-LLM sites)

(function () {
  'use strict';

  const SOURCE_TYPE = 'webpage';
  const MAX_CONTENT_LENGTH = 10000;
  const MIN_CONTENT_LENGTH = 150;
  const BUTTON_ID = 'continuum-manual-save-btn';

  let state = null;

  async function init() {
    try {
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    } catch (e) {
      return;
    }

    if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) {
      return;
    }

    injectFloatingButton();

    // Also listen to storage changes
    chrome.storage.onChanged.addListener(async () => {
      try {
        state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        const existing = document.getElementById(BUTTON_ID);
        if (!state || !state.activeProject || !state.captureEnabled || state.isBlocked) {
          if (existing) existing.remove();
        } else if (!existing) {
          injectFloatingButton();
        }
      } catch (e) {}
    });
  }

  function injectFloatingButton() {
    if (document.getElementById(BUTTON_ID)) return;
    if (!state || !state.activeProject || !state.captureEnabled) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.textContent = 'Save to ' + state.activeProject.name;
    btn.style.cssText = [
      'position: fixed',
      'bottom: 20px',
      'right: 20px',
      'background: #6c63ff',
      'color: white',
      'border: none',
      'border-radius: 24px',
      'padding: 10px 18px',
      'font-size: 13px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-weight: 500',
      'cursor: pointer',
      'z-index: 999999',
      'box-shadow: 0 4px 12px rgba(108, 99, 255, 0.4)',
      'transition: all 0.2s ease',
      'display: flex',
      'align-items: center',
      'gap: 8px',
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 16px rgba(108, 99, 255, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 12px rgba(108, 99, 255, 0.4)';
    });

    btn.addEventListener('click', async () => {
      btn.textContent = 'Saving...';
      btn.style.background = '#4a42d9';
      btn.disabled = true;

      const success = await capturePageContent();

      if (success) {
        btn.textContent = '✓ Saved to ' + state.activeProject.name;
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.style.opacity = '0';
          setTimeout(() => btn.remove(), 500);
        }, 2500);
      } else {
        btn.textContent = 'Too short to save';
        btn.style.background = '#ef4444';
        setTimeout(() => {
          btn.textContent = 'Save to ' + state.activeProject.name;
          btn.style.background = '#6c63ff';
          btn.disabled = false;
        }, 2500);
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

    const filtered = window.__continuumFilterPII
      ? window.__continuumFilterPII(content, state.privacyRules?.blocked_keywords || [])
      : content;

    const hostname = window.location.hostname;

    try {
      await chrome.runtime.sendMessage({
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
    } catch (err) {
      console.error('[Continuum] Capture failed:', err);
      return false;
    }
  }

  function extractMainContent() {
    const article = document.querySelector('article');
    if (article) {
      const text = cleanText(article.innerText);
      if (text.length >= MIN_CONTENT_LENGTH) return text;
    }

    const main = document.querySelector('main');
    if (main) {
      const text = cleanText(main.innerText);
      if (text.length >= MIN_CONTENT_LENGTH) return text;
    }

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

    return cleanText(document.body.innerText);
  }

  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t+/g, ' ')
      .replace(/ {3,}/g, ' ')
      .replace(/^\s+$/gm, '')
      .trim();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();