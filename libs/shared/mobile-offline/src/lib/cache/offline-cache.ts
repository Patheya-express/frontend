import {
  KeyValueStorage,
  LocalStorageKeyValueStorage,
} from '../storage/key-value-storage';

/** The envelope actually persisted — never the caller's `T` on its own — so version and age are always available for validation before `data` is trusted. */
interface CachedEnvelope<T> {
  readonly data: T;
  readonly cachedAt: number;
  readonly version: number;
}

/** What a successful read hands back: the data, when it was cached, and whether that's still within the TTL — `isStale` is informational, not a reason to discard `data`. */
export interface CacheReadResult<T> {
  readonly data: T;
  readonly cachedAt: number;
  readonly isStale: boolean;
}

function isCachedEnvelope<T>(value: unknown): value is CachedEnvelope<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // All-optional so the cast itself can never fail a structural-overlap check — this only
  // narrows far enough to inspect the two fields the version/corruption checks actually need.
  const candidate = value as Partial<CachedEnvelope<T>>;
  return (
    'data' in candidate &&
    typeof candidate.cachedAt === 'number' &&
    typeof candidate.version === 'number'
  );
}

/**
 * A small, generic, versioned, TTL-aware cache for exactly one JSON-serializable value per key —
 * the primitive the audit found missing (no reusable cache/fallback abstraction existed anywhere
 * in the frontend). Deliberately minimal: this is a resilience mechanism for read data the
 * backend remains authoritative over, not a general-purpose datastore.
 *
 * Every operation fails safe:
 *  - a storage error (see `LocalStorageKeyValueStorage`) is treated as "nothing cached"
 *  - malformed JSON is discarded (the corrupt entry is cleared) rather than thrown
 *  - a `version` mismatch is treated as an incompatible schema and discarded, never
 *    blindly deserialized as `T`
 *  - none of the above ever throws out of `read()`/`write()`/`clear()` — a caller can always treat
 *    a cache failure the same way it treats "no cache", never as a crash.
 *
 * Staleness is informational only: `read()` still returns `data` past `ttlMs`, with
 * `isStale: true` — expiration means "don't present this as current without revalidating," not
 * "this no longer exists." Callers decide what stale means for their own UI/business logic.
 */
export class OfflineCache<T> {
  constructor(
    private readonly key: string,
    private readonly version: number,
    private readonly ttlMs: number,
    private readonly storage: KeyValueStorage = new LocalStorageKeyValueStorage(),
    private readonly now: () => number = Date.now,
  ) {}

  async read(): Promise<CacheReadResult<T> | null> {
    let raw: string | null;
    try {
      raw = await this.storage.get(this.key);
    } catch {
      return null;
    }

    if (!raw) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await this.clear();
      return null;
    }

    if (!isCachedEnvelope<T>(parsed) || parsed.version !== this.version) {
      await this.clear();
      return null;
    }

    return {
      data: parsed.data,
      cachedAt: parsed.cachedAt,
      isStale: this.now() - parsed.cachedAt > this.ttlMs,
    };
  }

  async write(data: T): Promise<void> {
    const envelope: CachedEnvelope<T> = {
      data,
      cachedAt: this.now(),
      version: this.version,
    };

    try {
      await this.storage.set(this.key, JSON.stringify(envelope));
    } catch {
      // Best-effort — a failed cache write must never break the caller's real request flow.
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.remove(this.key);
    } catch {
      // Best-effort — see write()'s comment.
    }
  }
}
