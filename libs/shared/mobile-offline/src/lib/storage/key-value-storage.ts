/**
 * Minimal async key-value contract `OfflineCache` persists through — deliberately not
 * Capacitor-specific, so the cache layer above it doesn't care which mechanism backs it.
 */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * `localStorage`-backed implementation, wrapped in Promises to satisfy the async contract even
 * though the underlying calls are synchronous — so a future swap to a genuinely async mechanism
 * (IndexedDB, a Capacitor storage plugin) needs no change to `OfflineCache` or its callers.
 *
 * Chosen over the alternatives after checking what already exists in this repo:
 *  - `@capacitor/preferences` is not a workspace dependency (confirmed via `package.json`) and
 *    isn't the repository's established persistence mechanism — adding it would mean linking a
 *    new native plugin into all three mobile apps for what is, today, a single small JSON object.
 *  - IndexedDB would be a reasonable alternative but is unwarranted complexity for one bounded
 *    object; `NetworkStatusService` (`libs/shared/ui`) already establishes the precedent that
 *    plain web storage/DOM APIs work correctly inside a Capacitor WebView on both Android and iOS
 *    without a native plugin, which applies equally to `localStorage` here.
 *  - The secure-storage-plugin-backed token storage (`AuthStorageService`) is intentionally not
 *    reused — that mechanism exists for authentication secrets specifically (Keychain/Keystore on
 *    native), and this is explicitly non-sensitive, non-credential application data. Using the
 *    same mechanism would blur that boundary for no benefit.
 *
 * Every method fails safe: a thrown error (quota exceeded, storage disabled in a locked-down
 * WebView, `localStorage` unavailable in a non-browser test environment) is swallowed and treated
 * as "no value" / "write not persisted" rather than propagating — the offline cache is a
 * resilience nicety, and a storage failure here must never break the caller's real request flow.
 */
export class LocalStorageKeyValueStorage implements KeyValueStorage {
  async get(key: string): Promise<string | null> {
    try {
      return this.hasLocalStorage() ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      if (this.hasLocalStorage()) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Best-effort — see class doc comment.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (this.hasLocalStorage()) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Best-effort — see class doc comment.
    }
  }

  private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}
