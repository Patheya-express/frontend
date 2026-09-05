import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { Subject, firstValueFrom, of } from 'rxjs';
import {
  RequestCanceledError,
  classifyNetworkError,
} from '../errors/network-error';
import { cancellationInterceptor } from './cancellation.interceptor';
import { withAbortSignal } from './cancellation.token';

describe('cancellationInterceptor', () => {
  it('is a no-op when no AbortSignal is attached — passes the exact request through unchanged', () => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const next = jest.fn(() => of('ok'));

    cancellationInterceptor(req, next);

    expect(next).toHaveBeenCalledWith(req);
  });

  it('resolves normally when the request completes before cancellation', async () => {
    const controller = new AbortController();
    const req = new HttpRequest('GET', '/api/v1/restaurants', {
      context: withAbortSignal(controller.signal),
    });
    const next = jest.fn(() => of('ok'));

    await expect(
      firstValueFrom(cancellationInterceptor(req, next)),
    ).resolves.toBe('ok');
  });

  it('an explicitly cancelable request can be canceled', async () => {
    const controller = new AbortController();
    const req = new HttpRequest('GET', '/api/v1/search', {
      context: withAbortSignal(controller.signal),
    });
    const subject = new Subject<never>();
    const next = jest.fn(() => subject.asObservable());

    const promise = firstValueFrom(cancellationInterceptor(req, next));
    promise.catch(() => undefined);

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(RequestCanceledError);
  });

  it('rejects immediately, without calling next, if the signal is already aborted', () => {
    const controller = new AbortController();
    controller.abort();
    const req = new HttpRequest('GET', '/api/v1/search', {
      context: withAbortSignal(controller.signal),
    });
    const next = jest.fn(() => of('ok'));

    cancellationInterceptor(req, next).subscribe({ error: () => undefined });

    expect(next).not.toHaveBeenCalled();
  });

  it('classifies cancellation separately from a generic server error', async () => {
    const controller = new AbortController();
    const req = new HttpRequest('GET', '/api/v1/search', {
      context: withAbortSignal(controller.signal),
    });
    const subject = new Subject<never>();
    const next = jest.fn(() => subject.asObservable());

    const promise = firstValueFrom(cancellationInterceptor(req, next));
    promise.catch(() => undefined);
    controller.abort();

    const error = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RequestCanceledError);
    expect(classifyNetworkError(error)).toBe('canceled');
    expect(classifyNetworkError(error)).not.toBe(
      classifyNetworkError(new HttpErrorResponse({ status: 500 })),
    );
  });

  it('does not affect a request with no signal even if an unrelated signal elsewhere is aborted', async () => {
    const unrelatedController = new AbortController();
    unrelatedController.abort();
    const req = new HttpRequest('GET', '/api/v1/restaurants'); // no context/signal attached
    const next = jest.fn(() => of('ok'));

    await expect(
      firstValueFrom(cancellationInterceptor(req, next)),
    ).resolves.toBe('ok');
  });
});
