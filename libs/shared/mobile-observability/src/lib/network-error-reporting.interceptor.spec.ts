import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  CORRELATION_ID_CONTEXT,
  RequestCanceledError,
} from '@patheya-express-frontend/mobile-networking';
import { networkErrorReportingInterceptor } from './network-error-reporting.interceptor';
import { LoggerService } from './logger.service';

describe('networkErrorReportingInterceptor', () => {
  let logger: { warn: jest.Mock };

  beforeEach(() => {
    logger = { warn: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: logger }],
    });
  });

  function run(req: HttpRequest<unknown>, next: (req: HttpRequest<unknown>) => ReturnType<typeof of>) {
    return TestBed.runInInjectionContext(() => networkErrorReportingInterceptor(req, next as never));
  }

  it('passes a successful response through untouched, without logging anything', (done) => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const response = { body: { ok: true } };

    run(req, () => of(response)).subscribe((result) => {
      expect(result).toBe(response);
      expect(logger.warn).not.toHaveBeenCalled();
      done();
    });
  });

  it('logs a failed request classification and rethrows the exact same error, unchanged', (done) => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const error = new HttpErrorResponse({ status: 500 });

    run(req, () => throwError(() => error)).subscribe({
      error: (thrown) => {
        expect(thrown).toBe(error);
        expect(logger.warn).toHaveBeenCalledWith('http_request_failed', {
          errorClassification: 'server-error',
          correlationId: null,
        });
        done();
      },
    });
  });

  it('attaches the correlation ID that correlationIdInterceptor stamped on this request', (done) => {
    let req = new HttpRequest('GET', '/api/v1/restaurants');
    req = req.clone({ context: req.context.set(CORRELATION_ID_CONTEXT, 'req-123') });
    const error = new HttpErrorResponse({ status: 401 });

    run(req, () => throwError(() => error)).subscribe({
      error: () => {
        expect(logger.warn).toHaveBeenCalledWith('http_request_failed', {
          errorClassification: 'unauthorized',
          correlationId: 'req-123',
        });
        done();
      },
    });
  });

  it('classifies and logs a canceled request without turning it into a crash', (done) => {
    const req = new HttpRequest('GET', '/api/v1/restaurants');
    const error = new RequestCanceledError('/api/v1/restaurants');

    run(req, () => throwError(() => error)).subscribe({
      error: (thrown) => {
        expect(thrown).toBe(error);
        expect(logger.warn).toHaveBeenCalledWith('http_request_failed', {
          errorClassification: 'canceled',
          correlationId: null,
        });
        done();
      },
    });
  });
});
