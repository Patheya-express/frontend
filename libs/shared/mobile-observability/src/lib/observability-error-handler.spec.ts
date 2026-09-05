import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createErrorHandler } from '@sentry/angular';
import { RequestCanceledError, RequestTimeoutError } from '@patheya-express-frontend/mobile-networking';
import { ObservabilityErrorHandler } from './observability-error-handler';
import { LoggerService } from './logger.service';

jest.mock('@sentry/angular', () => ({
  createErrorHandler: jest.fn(),
}));

const mockedCreateErrorHandler = jest.mocked(createErrorHandler);

describe('ObservabilityErrorHandler', () => {
  let delegateHandleError: jest.Mock;
  let logger: { warn: jest.Mock };
  let handler: ObservabilityErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    delegateHandleError = jest.fn();
    mockedCreateErrorHandler.mockReturnValue({
      handleError: delegateHandleError,
    } as unknown as ReturnType<typeof createErrorHandler>);

    logger = { warn: jest.fn() };

    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: logger }],
    });
    handler = TestBed.runInInjectionContext(() => new ObservabilityErrorHandler());
  });

  it('logs a canceled HTTP request as a warning, never delegates to Sentry', () => {
    handler.handleError(new RequestCanceledError('/api/v1/orders'));

    expect(logger.warn).toHaveBeenCalledWith('unhandled_network_error', {
      errorClassification: 'canceled',
    });
    expect(delegateHandleError).not.toHaveBeenCalled();
  });

  it('logs a timeout as a warning, never delegates to Sentry', () => {
    handler.handleError(new RequestTimeoutError('/api/v1/orders', 15000));

    expect(logger.warn).toHaveBeenCalledWith('unhandled_network_error', {
      errorClassification: 'timeout',
    });
    expect(delegateHandleError).not.toHaveBeenCalled();
  });

  it('logs an expected 401 (auth refresh failure) as a warning, never a crash', () => {
    handler.handleError(new HttpErrorResponse({ status: 401 }));

    expect(logger.warn).toHaveBeenCalledWith('unhandled_network_error', {
      errorClassification: 'unauthorized',
    });
    expect(delegateHandleError).not.toHaveBeenCalled();
  });

  it('logs an offline/no-response failure as a warning, never a crash', () => {
    handler.handleError(new HttpErrorResponse({ status: 0 }));

    expect(logger.warn).toHaveBeenCalledWith('unhandled_network_error', {
      errorClassification: 'offline',
    });
    expect(delegateHandleError).not.toHaveBeenCalled();
  });

  it('delegates a genuinely unexpected error to the Sentry error handler', () => {
    const error = new TypeError('Cannot read properties of undefined');
    handler.handleError(error);

    expect(delegateHandleError).toHaveBeenCalledWith(error);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to console.error if the delegate itself throws', () => {
    delegateHandleError.mockImplementation(() => {
      throw new Error('sentry unavailable');
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const error = new TypeError('boom');
    expect(() => handler.handleError(error)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    consoleErrorSpy.mockRestore();
  });
});
