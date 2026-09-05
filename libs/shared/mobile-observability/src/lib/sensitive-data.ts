/**
 * Every diagnostic path in this library (logger metadata, Sentry `beforeSend`/`beforeBreadcrumb`,
 * error-context attachment) runs through {@link scrubSensitiveData} before leaving the app —
 * defense-in-depth on top of callers simply not passing sensitive fields in the first place. Keys
 * are matched case-insensitively and by substring, so `Authorization`, `authToken`, `access_token`,
 * `refreshToken`, `pushToken`, `x-request-id`-adjacent auth headers, etc. are all caught without
 * hand-listing every casing/naming convention used across this codebase and the backend it talks to.
 */
const SENSITIVE_KEY_PATTERN =
  /(authorization|auth[-_]?token|access[-_]?token|refresh[-_]?token|push[-_]?token|device[-_]?token|password|passcode|otp|pin\b|cookie|session[-_]?id|card[-_]?number|cvv|cvc|razorpay|payment|secret|api[-_]?key|private[-_]?key|latitude|longitude|coords?\b|gps)/i;

const MAX_DEPTH = 4;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/**
 * Recursively redacts any object key matching {@link SENSITIVE_KEY_PATTERN}, replacing its value
 * with `'[redacted]'`. Arrays are walked element-wise; primitives and non-plain objects (Date,
 * Error, etc.) pass through unchanged since they carry no keyed fields to inspect. Depth-limited so
 * a pathological/circular-ish structure can't hang diagnostic reporting — anything past
 * {@link MAX_DEPTH} is replaced wholesale with `'[truncated]'` rather than walked further.
 */
export function scrubSensitiveData<T>(value: T, depth = 0): T {
  if (depth >= MAX_DEPTH) {
    return '[truncated]' as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item, depth + 1)) as unknown as T;
  }

  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? '[redacted]' : scrubSensitiveData(entryValue, depth + 1);
  }
  return result as unknown as T;
}
