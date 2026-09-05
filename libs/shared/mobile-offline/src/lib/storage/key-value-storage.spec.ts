import { LocalStorageKeyValueStorage } from './key-value-storage';

describe('LocalStorageKeyValueStorage', () => {
  const storage = new LocalStorageKeyValueStorage();

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null for a key that was never set', async () => {
    expect(await storage.get('missing')).toBeNull();
  });

  it('round-trips a value through set/get', async () => {
    await storage.set('k', 'v');
    expect(await storage.get('k')).toBe('v');
  });

  it('removes a value', async () => {
    await storage.set('k', 'v');
    await storage.remove('k');
    expect(await storage.get('k')).toBeNull();
  });

  it('does not throw when the underlying storage throws on write', async () => {
    const spy = jest
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    await expect(storage.set('k', 'v')).resolves.toBeUndefined();

    spy.mockRestore();
  });

  it('does not throw and returns null when the underlying storage throws on read', async () => {
    const spy = jest
      .spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });

    await expect(storage.get('k')).resolves.toBeNull();

    spy.mockRestore();
  });

  it('does not throw when the underlying storage throws on remove', async () => {
    const spy = jest
      .spyOn(window.localStorage.__proto__, 'removeItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });

    await expect(storage.remove('k')).resolves.toBeUndefined();

    spy.mockRestore();
  });
});
