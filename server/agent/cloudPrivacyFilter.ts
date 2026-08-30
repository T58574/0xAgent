import os from 'node:os';

export interface CloudPrivacyFilterOptions {
  redactPaths?: boolean;
  redactSecrets?: boolean;
  userHome?: string;
  customRedactPatterns?: RegExp[];
}

export interface RedactionResult {
  sanitized: string;
  redactionsCount: number;
  redactedTypes: string[];
}

const COMMON_SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'google_api_key', regex: /\bAIzaSy[A-Za-z0-9_-]{28,50}\b/g },
  { name: 'openai_api_key', regex: /\bsk-[A-Za-z0-9_-]{24,80}\b/g },
  { name: 'anthropic_api_key', regex: /\bsk-ant-[A-Za-z0-9_-]{32,100}\b/g },
  { name: 'github_token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/g },
  { name: 'generic_bearer', regex: /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi },
  { name: 'private_key_block', regex: /-----BEGIN\s+[A-Z\s]+PRIVATE\s+KEY-----[\s\S]*?-----END\s+[A-Z\s]+PRIVATE\s+KEY-----/gi },
  { name: 'generic_password_assignment', regex: /(?:password|secret|api_key|token|access_key)\s*[:=]\s*["']([^"'\s]{6,})["']/gi },
];

/**
 * Sanitizes a single text string by stripping local absolute paths and masking secrets.
 */
export function sanitizeTextForCloud(text: string, options: CloudPrivacyFilterOptions = {}): RedactionResult {
  if (!text || typeof text !== 'string') {
    return { sanitized: text, redactionsCount: 0, redactedTypes: [] };
  }

  let sanitized = text;
  let redactionsCount = 0;
  const redactedTypes = new Set<string>();

  const redactPaths = options.redactPaths !== false;
  const redactSecrets = options.redactSecrets !== false;

  // 1. Path Sanitization
  if (redactPaths) {
    const home = (options.userHome || os.homedir()).replace(/\\/g, '/');
    const homeWin = home.replace(/\//g, '\\\\');

    // Windows C:\Users\name or Unix /home/name
    const homeRegexWin = new RegExp(homeWin, 'gi');
    const homeRegexUnix = new RegExp(home, 'gi');

    if (homeRegexWin.test(sanitized)) {
      sanitized = sanitized.replace(homeRegexWin, '~');
      redactionsCount++;
      redactedTypes.add('local_path');
    }
    if (homeRegexUnix.test(sanitized)) {
      sanitized = sanitized.replace(homeRegexUnix, '~');
      redactionsCount++;
      redactedTypes.add('local_path');
    }

    // Generic Windows user paths: C:\Users\<user>\ -> ~\
    const winUsersRegex = /[a-zA-Z]:\\Users\\[^\\]+\\/gi;
    if (winUsersRegex.test(sanitized)) {
      sanitized = sanitized.replace(winUsersRegex, '~\\');
      redactionsCount++;
      redactedTypes.add('local_path');
    }
  }

  // 2. Secret Redaction
  if (redactSecrets) {
    for (const item of COMMON_SECRET_PATTERNS) {
      if (item.name === 'generic_password_assignment') {
        sanitized = sanitized.replace(item.regex, (match, p1) => {
          redactionsCount++;
          redactedTypes.add(item.name);
          return match.replace(p1, '[REDACTED_SECRET]');
        });
      } else {
        if (item.regex.test(sanitized)) {
          sanitized = sanitized.replace(item.regex, `[REDACTED_${item.name.toUpperCase()}]`);
          redactionsCount++;
          redactedTypes.add(item.name);
        }
      }
    }

    // Custom user patterns
    if (options.customRedactPatterns && options.customRedactPatterns.length > 0) {
      for (const pattern of options.customRedactPatterns) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, '[REDACTED_CUSTOM]');
          redactionsCount++;
          redactedTypes.add('custom_pattern');
        }
      }
    }
  }

  return {
    sanitized,
    redactionsCount,
    redactedTypes: Array.from(redactedTypes),
  };
}

/**
 * Filter an array of chat messages before submitting to Cloud LLMs (Gemini / Claude / OpenAI).
 */
export function filterCloudPayload<T extends { role?: string; content?: any }>(
  messages: T[],
  options: CloudPrivacyFilterOptions = {}
): { sanitizedMessages: T[]; totalRedactions: number; redactedTypes: string[] } {
  let totalRedactions = 0;
  const allRedactedTypes = new Set<string>();

  const sanitizedMessages = messages.map((m) => {
    if (typeof m.content === 'string') {
      const res = sanitizeTextForCloud(m.content, options);
      totalRedactions += res.redactionsCount;
      res.redactedTypes.forEach((t) => allRedactedTypes.add(t));
      return { ...m, content: res.sanitized };
    }

    if (Array.isArray(m.content)) {
      const sanitizedParts = m.content.map((part: any) => {
        if (typeof part === 'string') {
          const res = sanitizeTextForCloud(part, options);
          totalRedactions += res.redactionsCount;
          res.redactedTypes.forEach((t) => allRedactedTypes.add(t));
          return res.sanitized;
        }
        if (part && typeof part === 'object' && part.text) {
          const res = sanitizeTextForCloud(part.text, options);
          totalRedactions += res.redactionsCount;
          res.redactedTypes.forEach((t) => allRedactedTypes.add(t));
          return { ...part, text: res.sanitized };
        }
        return part;
      });
      return { ...m, content: sanitizedParts };
    }

    return m;
  });

  return {
    sanitizedMessages,
    totalRedactions,
    redactedTypes: Array.from(allRedactedTypes),
  };
}
