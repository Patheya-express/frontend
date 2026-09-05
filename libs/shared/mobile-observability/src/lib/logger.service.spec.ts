import * as Sentry from '@sentry/capacitor';
import { LoggerService } from './logger.service';

jest.mock('@sentry/capacitor', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

const mockedSentry = jest.mocked(Sentry);

describe('LoggerService', () => {
  let logger: LoggerService;
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new LoggerService();
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('debug', () => {
    it('is silent outside development (no console, no breadcrumb)', () => {
      logger.configure('production');
      logger.debug('some_debug_event');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('logs to console and adds a breadcrumb in development', () => {
      logger.configure('development');
      logger.debug('some_debug_event', { feature: 'orders' });

      expect(debugSpy).toHaveBeenCalled();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'debug', message: 'some_debug_event' }),
      );
    });
  });

  describe('info', () => {
    it('logs to console and adds an info breadcrumb in every environment', () => {
      logger.configure('production');
      logger.info('order_placed', { feature: 'orders' });

      expect(infoSpy).toHaveBeenCalled();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info', message: 'order_placed' }),
      );
      expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('logs to console and adds a warning breadcrumb, without capturing a message', () => {
      logger.warn('unhandled_network_error', { errorClassification: 'timeout' });

      expect(warnSpy).toHaveBeenCalled();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warning', message: 'unhandled_network_error' }),
      );
      expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('logs to console, adds a breadcrumb, and captures an actual reportable message', () => {
      logger.error('push_registration_failed', { feature: 'push' });

      expect(errorSpy).toHaveBeenCalled();
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', message: 'push_registration_failed' }),
      );
      expect(mockedSentry.captureMessage).toHaveBeenCalledWith(
        'push_registration_failed',
        expect.objectContaining({ level: 'error' }),
      );
    });

    it('does not throw if Sentry.captureMessage itself throws', () => {
      mockedSentry.captureMessage.mockImplementation(() => {
        throw new Error('sentry unavailable');
      });

      expect(() => logger.error('some_event')).not.toThrow();
    });

    it('does not throw if Sentry.addBreadcrumb itself throws', () => {
      mockedSentry.addBreadcrumb.mockImplementation(() => {
        throw new Error('sentry unavailable');
      });

      expect(() => logger.warn('some_event')).not.toThrow();
    });
  });

  describe('sensitive data', () => {
    it('never forwards an Authorization header to a breadcrumb', () => {
      logger.info('http_call', { Authorization: 'Bearer secret' });
      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({ Authorization: '[redacted]' });
    });

    it('never forwards an access token', () => {
      logger.warn('token_event', { accessToken: 'abc' });
      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({ accessToken: '[redacted]' });
    });

    it('never forwards a refresh token', () => {
      logger.warn('token_event', { refreshToken: 'abc' });
      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({ refreshToken: '[redacted]' });
    });

    it('never forwards a push token', () => {
      logger.info('push_event', { pushToken: 'abc' });
      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({ pushToken: '[redacted]' });
    });

    it('never forwards GPS coordinates', () => {
      logger.info('location_event', { latitude: 12.9, longitude: 77.6 });
      const call = mockedSentry.addBreadcrumb.mock.calls[0][0];
      expect(call.data).toEqual({ latitude: '[redacted]', longitude: '[redacted]' });
    });

    it('never forwards payment secrets to a captured error message', () => {
      logger.error('payment_error', { razorpaySignature: 'x', cardNumber: 'y' });
      const call = mockedSentry.captureMessage.mock.calls[0][1] as { extra?: Record<string, unknown> };
      expect(call.extra).toEqual({ razorpaySignature: '[redacted]', cardNumber: '[redacted]' });
    });
  });
});
