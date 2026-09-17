// Continuum — Chrome Storage Helpers

export const Storage = {
  async get(key) {
    const data = await chrome.storage.local.get(key);
    return data[key];
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async getActiveProject() {
    return await this.get('activeProject');
  },

  async setActiveProject(project) {
    await this.set('activeProject', project);
  },

  async getAuthToken() {
    return await this.get('authToken') || '';
  },

  async setAuthToken(token) {
    await this.set('authToken', token);
  },

  async getPrivacyRules() {
    return await this.get('privacyRules') || {
      blocked_domains: ['web.whatsapp.com', 'mail.google.com', 'onlinesbi.com', 'netbanking.hdfcbank.com'],
      blocked_keywords: ['password', 'OTP', 'CVV', 'PIN'],
      capture_enabled: true,
    };
  },

  async setPrivacyRules(rules) {
    await this.set('privacyRules', rules);
  },

  async getCaptureEnabled() {
    const val = await this.get('captureEnabled');
    return val !== false; // Default true
  },

  async setCaptureEnabled(enabled) {
    await this.set('captureEnabled', enabled);
  },
};
