import { HttpRequest } from '@angular/common/http';
import { Subject, firstValueFrom, of } from 'rxjs';
import { RequestTimeoutError } from '../errors/network-error';
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  UPLOAD_HTTP_TIMEOUT_MS,
} from './http-timeout.constants';
import { httpTimeoutInterceptor } from './http-timeout.interceptor';

/**
 * `promise` may not have settled yet (it's waiting on a fake timer that hasn't fired). Racing it
 * against an already-resolved promise is a standard way to observe "still pending" vs "settled"
 * without a real wall-clock wait: if `promise` hasn't settled, its `.then` callback isn't even
 * queued yet, so the already-queued `Promise.resolve('pending')` always wins that microtask race.
 */
async function settlementOf(
  promise: Promise<unknown>,
): Promise<'settled' | 'pending'> {
  const marker = promise.then(
    () => 'settled' as const,
    () => 'settled' as const,
  );
  return Promise.race([marker, Promise.resolve('pending' as const)]);
}

describe('httpTimeoutInterceptor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves normally when the response arrives before the timeout', async () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn(() => of('ok'));

    await expect(
      firstValueFrom(httpTimeoutInterceptor(req, next)),
    ).resolves.toBe('ok');
  });

  it('does not mutate business state — it only rejects the promise, nothing else', async () => {
    // Nothing in this interceptor touches a store/signal; this documents that as an assertion
    // rather than leaving it implicit — the only side effect of a timeout is the rejection itself.
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn(() => new Subject<never>().asObservable());

    const promise = firstValueFrom(httpTimeoutInterceptor(req, next));
    promise.catch(() => undefined);

    jest.advanceTimersByTime(DEFAULT_HTTP_TIMEOUT_MS + 1);
    await expect(promise).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('times out a hung JSON request after the default timeout and classifies it as RequestTimeoutError', async () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn(() => new Subject<never>().asObservable());

    const promise = firstValueFrom(httpTimeoutInterceptor(req, next));
    promise.catch(() => undefined);

    jest.advanceTimersByTime(DEFAULT_HTTP_TIMEOUT_MS + 1);

    await expect(promise).rejects.toBeInstanceOf(RequestTimeoutError);
    await expect(promise).rejects.toMatchObject({
      url: req.url,
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
    });
  });

  it('does not time out a request that is still within the default window', async () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn(() => new Subject<never>().asObservable());

    const promise = firstValueFrom(httpTimeoutInterceptor(req, next));
    promise.catch(() => undefined);

    jest.advanceTimersByTime(DEFAULT_HTTP_TIMEOUT_MS - 1);

    expect(await settlementOf(promise)).toBe('pending');
  });

  it('does not time out a FormData (upload) request at the default-timeout mark', async () => {
    const req = new HttpRequest(
      'POST',
      '/api/v1/restaurants/1/logo',
      new FormData(),
    );
    const next = jest.fn(() => new Subject<never>().asObservable());

    const promise = firstValueFrom(httpTimeoutInterceptor(req, next));
    promise.catch(() => undefined);

    jest.advanceTimersByTime(DEFAULT_HTTP_TIMEOUT_MS + 1);

    expect(await settlementOf(promise)).toBe('pending');
  });

  it('times out a hung FormData (upload) request after the longer upload timeout', async () => {
    const req = new HttpRequest(
      'POST',
      '/api/v1/restaurants/1/logo',
      new FormData(),
    );
    const next = jest.fn(() => new Subject<never>().asObservable());

    const promise = firstValueFrom(httpTimeoutInterceptor(req, next));
    promise.catch(() => undefined);

    jest.advanceTimersByTime(UPLOAD_HTTP_TIMEOUT_MS + 1);

    await expect(promise).rejects.toBeInstanceOf(RequestTimeoutError);
    await expect(promise).rejects.toMatchObject({
      timeoutMs: UPLOAD_HTTP_TIMEOUT_MS,
    });
  });

  it('passes through a non-timeout error unchanged', async () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const businessError = new Error('backend said no');
    const subject = new Subject<never>();
    const next = jest.fn(() => subject.asObservable());

    const promise = firstValueFrom(httpTimeoutInterceptor(req, next));
    promise.catch(() => undefined);

    subject.error(businessError);

    await expect(promise).rejects.toBe(businessError);
  });
});
