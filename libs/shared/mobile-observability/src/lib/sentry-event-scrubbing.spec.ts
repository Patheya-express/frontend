import type { Breadcrumb, Event } from '@sentry/capacitor';
import { scrubSentryBreadcrumb, scrubSentryEvent } from './sentry-event-scrubbing';

describe('scrubSentryEvent', () => {
  it('redacts Authorization/Cookie headers nested under request', () => {
    const event: Event = {
      request: {
        url: 'https://api.example.com/orders',
        headers: { Authorization: 'Bearer secret', Cookie: 'session=abc' },
      },
    };

    const result = scrubSentryEvent(event);

    expect(result.request?.headers).toEqual({
      Authorization: '[redacted]',
      Cookie: '[redacted]',
    });
    expect(result.request?.url).toBe('https://api.example.com/orders');
  });

  it('scrubs extra and contexts', () => {
    const event: Event = {
      extra: { accessToken: 'x', note: 'safe' },
      contexts: { device: { model: 'Pixel', pushToken: 'y' } },
    };

    const result = scrubSentryEvent(event);

    expect(result.extra).toEqual({ accessToken: '[redacted]', note: 'safe' });
    expect(result.contexts?.['device']).toEqual({ model: 'Pixel', pushToken: '[redacted]' });
  });

  it('reduces user to id only', () => {
    const event: Event = {
      user: { id: 'user-1', email: 'user@example.com', ip_address: '1.2.3.4' },
    };

    const result = scrubSentryEvent(event);

    expect(result.user).toEqual({ id: 'user-1' });
  });

  it('drops user entirely if it has no id', () => {
    const event: Event = { user: { email: 'user@example.com' } };
    expect(scrubSentryEvent(event).user).toBeUndefined();
  });

  it('passes through an event with none of these fields unchanged', () => {
    const event: Event = { message: 'hello' };
    expect(scrubSentryEvent(event)).toEqual(event);
  });
});

describe('scrubSentryBreadcrumb', () => {
  it('redacts sensitive keys inside breadcrumb data', () => {
    const breadcrumb: Breadcrumb = {
      category: 'http',
      data: { url: '/api/v1/notifications/push-token', pushToken: 'abc' },
    };

    const result = scrubSentryBreadcrumb(breadcrumb);

    expect(result.data).toEqual({
      url: '/api/v1/notifications/push-token',
      pushToken: '[redacted]',
    });
  });

  it('passes through a breadcrumb with no data unchanged', () => {
    const breadcrumb: Breadcrumb = { category: 'navigation' };
    expect(scrubSentryBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });
});
