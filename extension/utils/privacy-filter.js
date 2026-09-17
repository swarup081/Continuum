// Continuum — Local Privacy Pre-Filter
// Strips PII patterns BEFORE content leaves the browser
// This runs in content scripts (injected before the capture scripts)

const PII_PATTERNS = [
  {
    name: 'credit_card',
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CARD_REDACTED]'
  },
  {
    name: 'otp',
    regex: /\b(?:OTP|otp|Otp)[\s:]*\d{4,8}\b/g,
    replacement: '[OTP_REDACTED]'
  },
  {
    name: 'password_field',
    regex: /(?:password|passwd|pwd|passcode)[\s:=]+\S+/gi,
    replacement: '[PASSWORD_REDACTED]'
  },
  {
    name: 'aadhaar',
    regex: /\b\d{4}\s\d{4}\s\d{4}\b/g,
    replacement: '[AADHAAR_REDACTED]'
  },
  {
    name: 'pan_card',
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: '[PAN_REDACTED]'
  },
  {
    name: 'indian_phone',
    regex: /\b(?:\+91[\s-]?)?\d{10}\b/g,
    replacement: '[PHONE_REDACTED]'
  },
  {
    name: 'email_address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]'
  },
  {
    name: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN_REDACTED]'
  },
  {
    name: 'cvv',
    regex: /\b(?:CVV|cvv|CVC|cvc)[\s:]*\d{3,4}\b/g,
    replacement: '[CVV_REDACTED]'
  },
  {
    name: 'api_key',
    regex: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)[\s:="']+[A-Za-z0-9\-_]{20,}/gi,
    replacement: '[API_KEY_REDACTED]'
  },
];

/**
 * Filter PII from text before sending to backend.
 * @param {string} text - Raw text to filter
 * @param {string[]} blockedKeywords - Additional keywords to strip
 * @returns {string} Filtered text
 */
function filterPII(text, blockedKeywords = []) {
  let filtered = text;

  // Apply regex patterns
  for (const pattern of PII_PATTERNS) {
    filtered = filtered.replace(pattern.regex, pattern.replacement);
  }

  // Apply blocked keywords (case-insensitive)
  for (const keyword of blockedKeywords) {
    if (keyword && keyword.length > 0) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      filtered = filtered.replace(regex, '[BLOCKED]');
    }
  }

  return filtered;
}

// Make available to content scripts
if (typeof window !== 'undefined') {
  window.__continuumFilterPII = filterPII;
}
