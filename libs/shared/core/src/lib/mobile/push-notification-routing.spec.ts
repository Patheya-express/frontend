import { resolvePushTapRoute } from './push-notification-routing';

describe('resolvePushTapRoute', () => {
  it('resolves an id-based route when the payload carries a valid id', () => {
    const path = resolvePushTapRoute(
      { notificationId: 'abc123' },
      { rootSegment: 'notifications', idField: 'notificationId' },
    );
    expect(path).toBe('/notifications/abc123');
  });

  it('falls back to the bare route when the id field is missing', () => {
    const path = resolvePushTapRoute(
      {},
      { rootSegment: 'notifications', idField: 'notificationId' },
    );
    expect(path).toBe('/notifications');
  });

  it('falls back to the bare route when data is null', () => {
    const path = resolvePushTapRoute(null, {
      rootSegment: 'notifications',
      idField: 'notificationId',
    });
    expect(path).toBe('/notifications');
  });

  it('falls back to the bare route when the id fails deep-link validation', () => {
    const path = resolvePushTapRoute(
      { notificationId: 'abc.123' },
      { rootSegment: 'notifications', idField: 'notificationId' },
    );
    expect(path).toBe('/notifications');
  });

  it('falls back to the bare route when the id field is not a string', () => {
    const path = resolvePushTapRoute(
      { notificationId: 12345 },
      { rootSegment: 'notifications', idField: 'notificationId' },
    );
    expect(path).toBe('/notifications');
  });

  it('resolves the bare route directly when no idField is configured', () => {
    const path = resolvePushTapRoute(
      { orderId: 'should-be-ignored' },
      { rootSegment: 'assignments' },
    );
    expect(path).toBe('/assignments');
  });

  it('returns null when rootSegment itself is not allow-listed', () => {
    const path = resolvePushTapRoute(null, { rootSegment: 'checkout' });
    expect(path).toBeNull();
  });
});
