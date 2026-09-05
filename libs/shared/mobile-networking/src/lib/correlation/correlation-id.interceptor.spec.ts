import { HttpRequest } from '@angular/common/http';
import { of } from 'rxjs';
import { correlationIdInterceptor } from './correlation-id.interceptor';
import { CORRELATION_ID_CONTEXT, REQUEST_ID_HEADER } from './correlation-id';

describe('correlationIdInterceptor', () => {
  it('attaches an X-Request-Id header to every outgoing request', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(req, next).subscribe();

    const forwardedReq = next.mock.calls[0][0] as HttpRequest<unknown>;
    expect(forwardedReq.headers.has(REQUEST_ID_HEADER)).toBe(true);
    expect(forwardedReq.headers.get(REQUEST_ID_HEADER)).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });

  it('does not mutate the original request object (HttpRequest is immutable; clone only)', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(req, next);

    expect(req.headers.has(REQUEST_ID_HEADER)).toBe(false);
  });

  it('never puts the correlation ID in the URL or query parameters', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(req, next).subscribe();

    const forwardedReq = next.mock.calls[0][0] as HttpRequest<unknown>;
    expect(forwardedReq.url).toBe(req.url);
    expect(forwardedReq.params.keys().length).toBe(0);
  });

  it('generates a different ID for two separate top-level requests', () => {
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(
      new HttpRequest('GET', '/api/v1/restaurants'),
      next,
    ).subscribe();
    correlationIdInterceptor(
      new HttpRequest('GET', '/api/v1/restaurants'),
      next,
    ).subscribe();

    const [firstReq, secondReq] = next.mock.calls.map(
      (call) => call[0] as HttpRequest<unknown>,
    );
    expect(firstReq.headers.get(REQUEST_ID_HEADER)).not.toBe(
      secondReq.headers.get(REQUEST_ID_HEADER),
    );
  });

  it('preserves the same ID across a clone the way authInterceptor retries a request', () => {
    // Mirrors what authInterceptor actually does: clone the same stamped `req` again (e.g. to
    // attach a refreshed Authorization header) rather than cloning the already-forwarded request.
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(req, next).subscribe();
    const stampedReq = next.mock.calls[0][0] as HttpRequest<unknown>;

    const retryReq = stampedReq.clone({
      setHeaders: { Authorization: 'Bearer new-token' },
    });

    expect(retryReq.headers.get(REQUEST_ID_HEADER)).toBe(
      stampedReq.headers.get(REQUEST_ID_HEADER),
    );
  });

  it('exposes the same ID via CORRELATION_ID_CONTEXT (M7: readable by an observability interceptor)', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(req, next).subscribe();
    const forwardedReq = next.mock.calls[0][0] as HttpRequest<unknown>;

    expect(forwardedReq.context.get(CORRELATION_ID_CONTEXT)).toBe(
      forwardedReq.headers.get(REQUEST_ID_HEADER),
    );
  });

  it('CORRELATION_ID_CONTEXT survives a further clone the way the header does', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn((forwarded: HttpRequest<unknown>) => of(forwarded));

    correlationIdInterceptor(req, next).subscribe();
    const stampedReq = next.mock.calls[0][0] as HttpRequest<unknown>;
    const retryReq = stampedReq.clone({
      setHeaders: { Authorization: 'Bearer new-token' },
    });

    expect(retryReq.context.get(CORRELATION_ID_CONTEXT)).toBe(
      stampedReq.context.get(CORRELATION_ID_CONTEXT),
    );
  });

  it('defaults to null for a request that never went through the interceptor', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    expect(req.context.get(CORRELATION_ID_CONTEXT)).toBeNull();
  });
});
