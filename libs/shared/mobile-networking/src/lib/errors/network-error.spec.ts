import { HttpErrorResponse } from '@angular/common/http';
import {
  RequestCanceledError,
  RequestTimeoutError,
  classifyNetworkError,
} from './network-error';

describe('classifyNetworkError', () => {
  it('classifies a RequestTimeoutError as timeout', () => {
    expect(
      classifyNetworkError(
        new RequestTimeoutError('/api/v1/restaurants', 20_000),
      ),
    ).toBe('timeout');
  });

  it('classifies a RequestCanceledError as canceled', () => {
    expect(
      classifyNetworkError(new RequestCanceledError('/api/v1/restaurants')),
    ).toBe('canceled');
  });

  it('classifies status 0 as offline (no response ever came back)', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(classifyNetworkError(error)).toBe('offline');
  });

  it('classifies 401 as unauthorized', () => {
    expect(classifyNetworkError(new HttpErrorResponse({ status: 401 }))).toBe(
      'unauthorized',
    );
  });

  it('classifies 403 as forbidden', () => {
    expect(classifyNetworkError(new HttpErrorResponse({ status: 403 }))).toBe(
      'forbidden',
    );
  });

  it('classifies other 4xx as client-error', () => {
    expect(classifyNetworkError(new HttpErrorResponse({ status: 400 }))).toBe(
      'client-error',
    );
    expect(classifyNetworkError(new HttpErrorResponse({ status: 404 }))).toBe(
      'client-error',
    );
    expect(classifyNetworkError(new HttpErrorResponse({ status: 422 }))).toBe(
      'client-error',
    );
  });

  it('classifies 5xx as server-error', () => {
    expect(classifyNetworkError(new HttpErrorResponse({ status: 500 }))).toBe(
      'server-error',
    );
    expect(classifyNetworkError(new HttpErrorResponse({ status: 503 }))).toBe(
      'server-error',
    );
  });

  it('classifies a non-HTTP, non-timeout, non-cancellation error as unknown', () => {
    expect(classifyNetworkError(new Error('boom'))).toBe('unknown');
    expect(classifyNetworkError('a plain string')).toBe('unknown');
    expect(classifyNetworkError(undefined)).toBe('unknown');
  });

  it('never reclassifies a timeout as offline, or vice versa', () => {
    expect(classifyNetworkError(new RequestTimeoutError('/x', 1))).not.toBe(
      'offline',
    );
    expect(classifyNetworkError(new HttpErrorResponse({ status: 0 }))).not.toBe(
      'timeout',
    );
  });
});
