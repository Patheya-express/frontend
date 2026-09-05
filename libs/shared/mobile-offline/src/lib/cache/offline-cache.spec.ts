import type { KeyValueStorage } from '../storage/key-value-storage';
import { OfflineCache } from './offline-cache';

class FakeStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  failNextGet = false;

  async get(key: string): Promise<string | null> {
    if (this.failNextGet) {
      throw new Error('simulated storage failure');
    }
    return this.map.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }

  raw(key: string): string | undefined {
    return this.map.get(key);
  }
}

interface Widget {
  id: string;
  name: string;
}

const KEY = 'test.widget';
const VERSION = 1;
const TTL_MS = 1_000;

describe('OfflineCache', () => {
  let storage: FakeStorage;
  let clock: number;
  let cache: OfflineCache<Widget>;

  beforeEach(() => {
    storage = new FakeStorage();
    clock = 1_000_000;
    cache = new OfflineCache<Widget>(
      KEY,
      VERSION,
      TTL_MS,
      storage,
      () => clock,
    );
  });

  it('returns null when nothing has been cached', async () => {
    expect(await cache.read()).toBeNull();
  });

  it('writes then reads back the same value, fresh', async () => {
    await cache.write({ id: '1', name: 'Widget' });

    const result = await cache.read();

    expect(result).toEqual({
      data: { id: '1', name: 'Widget' },
      cachedAt: clock,
      isStale: false,
    });
  });

  it('removes a cached value on clear()', async () => {
    await cache.write({ id: '1', name: 'Widget' });
    await cache.clear();

    expect(await cache.read()).toBeNull();
  });

  it('marks a read as stale once the TTL has elapsed, without discarding the data', async () => {
    await cache.write({ id: '1', name: 'Widget' });
    clock += TTL_MS + 1;

    const result = await cache.read();

    expect(result).not.toBeNull();
    expect(result?.data).toEqual({ id: '1', name: 'Widget' });
    expect(result?.isStale).toBe(true);
  });

  it('does not mark a read stale exactly at the TTL boundary before it elapses', async () => {
    await cache.write({ id: '1', name: 'Widget' });
    clock += TTL_MS - 1;

    const result = await cache.read();

    expect(result?.isStale).toBe(false);
  });

  it('discards and returns null for an incompatible cache version', async () => {
    await storage.set(
      KEY,
      JSON.stringify({
        data: { id: '1', name: 'Widget' },
        cachedAt: clock,
        version: 999,
      }),
    );

    const result = await cache.read();

    expect(result).toBeNull();
    expect(storage.raw(KEY)).toBeUndefined(); // the incompatible entry was discarded, not left behind
  });

  it('discards and returns null for malformed JSON rather than throwing', async () => {
    await storage.set(KEY, 'not valid json {{{');

    await expect(cache.read()).resolves.toBeNull();
    expect(storage.raw(KEY)).toBeUndefined();
  });

  it('discards and returns null for a structurally invalid envelope (missing fields)', async () => {
    await storage.set(KEY, JSON.stringify({ data: { id: '1' } })); // no cachedAt/version

    await expect(cache.read()).resolves.toBeNull();
  });

  it('fails safe (returns null, does not throw) when the underlying storage read fails', async () => {
    storage.failNextGet = true;

    await expect(cache.read()).resolves.toBeNull();
  });

  it('a later write overwrites an earlier one for the same key', async () => {
    await cache.write({ id: '1', name: 'First' });
    await cache.write({ id: '2', name: 'Second' });

    const result = await cache.read();

    expect(result?.data).toEqual({ id: '2', name: 'Second' });
  });
});
