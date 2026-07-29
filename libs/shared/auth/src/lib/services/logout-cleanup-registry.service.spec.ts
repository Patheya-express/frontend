import { LogoutCleanupRegistry } from './logout-cleanup-registry.service';

describe('LogoutCleanupRegistry', () => {
  let registry: LogoutCleanupRegistry;

  beforeEach(() => {
    registry = new LogoutCleanupRegistry();
  });

  it('runs every registered handler', () => {
    const a = jest.fn();
    const b = jest.fn();
    registry.register(a);
    registry.register(b);

    registry.runAll();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('runs every other handler even when one throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const before = jest.fn();
    const broken = jest.fn(() => {
      throw new Error('store reset blew up');
    });
    const after = jest.fn();
    registry.register(before);
    registry.register(broken);
    registry.register(after);

    expect(() => registry.runAll()).not.toThrow();

    expect(before).toHaveBeenCalledTimes(1);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('unregister removes only that handler', () => {
    const kept = jest.fn();
    const removed = jest.fn();
    registry.register(kept);
    const unregister = registry.register(removed);

    unregister();
    registry.runAll();

    expect(kept).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
  });

  it('runAll with no registered handlers does nothing and does not throw', () => {
    expect(() => registry.runAll()).not.toThrow();
  });
});
