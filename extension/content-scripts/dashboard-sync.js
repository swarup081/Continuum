// Syncs the auth token from the Dashboard to the Extension
(function() {
  const token = localStorage.getItem('continuum_token');
  if (token) {
    try {
      chrome.runtime.sendMessage({
        type: 'SYNC_TOKEN',
        token: token
      });
      console.log('[Continuum] Synced auth token from dashboard to extension');
    } catch (e) {
      // Ignore extension context invalidated errors during reload
    }
  }
})();
