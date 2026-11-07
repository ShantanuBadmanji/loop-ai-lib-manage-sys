const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
];

/**
 * Recursively replaces sensitive values with '[REDACTED]'. Used before any
 * credential-bearing payload reaches the logs.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redact(val);
      }
    }
    return out;
  }
  return value;
}
