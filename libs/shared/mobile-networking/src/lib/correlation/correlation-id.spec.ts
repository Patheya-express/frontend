import { generateRequestId } from './correlation-id';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateRequestId', () => {
  it('returns a v4-UUID-shaped string', () => {
    expect(generateRequestId()).toMatch(UUID_PATTERN);
  });

  it('generates a different ID on every call', () => {
    const first = generateRequestId();
    const second = generateRequestId();
    expect(first).not.toBe(second);
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    const originalRandomUUID = globalThis.crypto.randomUUID;
    // Simulates iOS 15.0–15.3's WKWebView, which has getRandomValues but not randomUUID.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.crypto as any).randomUUID = undefined;

    try {
      expect(generateRequestId()).toMatch(UUID_PATTERN);
    } finally {
      globalThis.crypto.randomUUID = originalRandomUUID;
    }
  });

  it('contains no separators or characters that would need escaping in a header value', () => {
    // A basic sanity check that this is safe to hand straight to `setHeaders` — not a full
    // HTTP header grammar validation.
    expect(generateRequestId()).not.toMatch(/[\s\r\n]/);
  });
});
