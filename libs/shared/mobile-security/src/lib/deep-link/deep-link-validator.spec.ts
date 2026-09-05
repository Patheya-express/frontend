import { validateDeepLink } from './deep-link-validator';

describe('validateDeepLink', () => {
  it('allows the bare restaurants list link', () => {
    const result = validateDeepLink('patheyaexpress://restaurants');
    expect(result).toEqual({ allowed: true, routerPath: '/restaurants' });
  });

  it('allows a restaurant detail link', () => {
    const result = validateDeepLink('patheyaexpress://restaurants/abc123');
    expect(result).toEqual({
      allowed: true,
      routerPath: '/restaurants/abc123',
    });
  });

  it('allows a restaurant offers link', () => {
    const result = validateDeepLink(
      'patheyaexpress://restaurants/abc123/offers',
    );
    expect(result).toEqual({
      allowed: true,
      routerPath: '/restaurants/abc123/offers',
    });
  });

  it('is case-insensitive on the route segment and the offers suffix', () => {
    const result = validateDeepLink(
      'patheyaexpress://Restaurants/abc123/OFFERS',
    );
    expect(result).toEqual({
      allowed: true,
      routerPath: '/restaurants/abc123/offers',
    });
  });

  it('rejects an unsupported scheme', () => {
    const result = validateDeepLink(
      'https://patheyaexpress.com/restaurants/abc123',
    );
    expect(result).toEqual({ allowed: false, reason: 'unsupported-scheme' });
  });

  it('rejects an external URL outright, never treating it as an internal route', () => {
    const result = validateDeepLink('https://evil.example/restaurants/abc123');
    expect(result).toEqual({ allowed: false, reason: 'unsupported-scheme' });
  });

  it('rejects an unknown/non-allow-listed route', () => {
    const result = validateDeepLink('patheyaexpress://checkout/abc123');
    expect(result).toEqual({ allowed: false, reason: 'unknown-route' });
  });

  it('rejects an auth-protected route that was never meant to be a content deep link', () => {
    const result = validateDeepLink('patheyaexpress://account');
    expect(result).toEqual({ allowed: false, reason: 'unknown-route' });
  });

  it('rejects an invalid path with too many segments', () => {
    const result = validateDeepLink(
      'patheyaexpress://restaurants/abc123/reviews/extra',
    );
    expect(result).toEqual({ allowed: false, reason: 'invalid-route-segment' });
  });

  it('rejects an invalid path with an unrecognized second segment', () => {
    const result = validateDeepLink(
      'patheyaexpress://restaurants/abc123/reviews',
    );
    expect(result).toEqual({ allowed: false, reason: 'invalid-route-segment' });
  });

  it('rejects a malformed URL', () => {
    const result = validateDeepLink('not a url');
    expect(result).toEqual({ allowed: false, reason: 'malformed-url' });
  });

  it('rejects an empty URL', () => {
    const result = validateDeepLink('');
    expect(result).toEqual({ allowed: false, reason: 'malformed-url' });
  });

  it('rejects unexpected query parameters', () => {
    const result = validateDeepLink(
      'patheyaexpress://restaurants/abc123?ref=campaign',
    );
    expect(result).toEqual({ allowed: false, reason: 'unexpected-query' });
  });

  it('rejects an unexpected query even on the bare list link', () => {
    const result = validateDeepLink('patheyaexpress://restaurants?debug=1');
    expect(result).toEqual({ allowed: false, reason: 'unexpected-query' });
  });

  it('rejects userinfo smuggled into the authority', () => {
    const result = validateDeepLink(
      'patheyaexpress://restaurants@evil.example/abc123',
    );
    expect(result).toEqual({ allowed: false, reason: 'unexpected-authority' });
  });

  it('rejects a port smuggled into the authority', () => {
    const result = validateDeepLink('patheyaexpress://restaurants:8080/abc123');
    expect(result).toEqual({ allowed: false, reason: 'unexpected-authority' });
  });

  // M6: notification-tap navigation destinations.

  it('allows the bare notifications list link', () => {
    const result = validateDeepLink('patheyaexpress://notifications');
    expect(result).toEqual({ allowed: true, routerPath: '/notifications' });
  });

  it('allows a notification detail link', () => {
    const result = validateDeepLink('patheyaexpress://notifications/abc123');
    expect(result).toEqual({
      allowed: true,
      routerPath: '/notifications/abc123',
    });
  });

  it('rejects a notification link with an extra path segment', () => {
    const result = validateDeepLink(
      'patheyaexpress://notifications/abc123/extra',
    );
    expect(result).toEqual({ allowed: false, reason: 'invalid-route-segment' });
  });

  it('rejects a query string on a notification link', () => {
    const result = validateDeepLink('patheyaexpress://notifications?ref=push');
    expect(result).toEqual({ allowed: false, reason: 'unexpected-query' });
  });

  it('allows the bare orders list link', () => {
    const result = validateDeepLink('patheyaexpress://orders');
    expect(result).toEqual({ allowed: true, routerPath: '/orders' });
  });

  it('allows an order detail link', () => {
    const result = validateDeepLink('patheyaexpress://orders/abc123');
    expect(result).toEqual({ allowed: true, routerPath: '/orders/abc123' });
  });

  it('allows the bare assignments list link', () => {
    const result = validateDeepLink('patheyaexpress://assignments');
    expect(result).toEqual({ allowed: true, routerPath: '/assignments' });
  });

  it('rejects an assignment link with an id segment — no per-assignment route exists to validate it against', () => {
    const result = validateDeepLink('patheyaexpress://assignments/abc123');
    expect(result).toEqual({ allowed: false, reason: 'invalid-route-segment' });
  });

  it('rejects an invalid id segment on a notification link', () => {
    const result = validateDeepLink('patheyaexpress://notifications/abc.123');
    expect(result).toEqual({ allowed: false, reason: 'invalid-route-segment' });
  });
});
