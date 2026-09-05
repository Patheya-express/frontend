import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { PushNotificationsService } from './push-notifications.service';

jest.mock('@capacitor/core', () => ({
  ...jest.requireActual('@capacitor/core'),
  Capacitor: { isNativePlatform: jest.fn() },
}));

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: jest.fn(),
    addListener: jest.fn(),
    register: jest.fn(),
    removeAllListeners: jest.fn(),
    unregister: jest.fn(),
  },
}));

const mockedCapacitor = jest.mocked(Capacitor);
const mockedPushNotifications = jest.mocked(PushNotifications);

type ListenerMap = Map<string, (event: unknown) => void>;

function captureListeners(): ListenerMap {
  const listeners: ListenerMap = new Map();
  mockedPushNotifications.addListener.mockImplementation(
    ((event: string, handler: (event: unknown) => void) => {
      listeners.set(event, handler);
      return Promise.resolve({ remove: jest.fn() });
    }) as typeof PushNotifications.addListener,
  );
  return listeners;
}

describe('PushNotificationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPushNotifications.register.mockResolvedValue();
    mockedPushNotifications.removeAllListeners.mockResolvedValue();
    mockedPushNotifications.unregister.mockResolvedValue();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createService(): PushNotificationsService {
    TestBed.configureTestingModule({});
    return TestBed.inject(PushNotificationsService);
  }

  describe('on web', () => {
    beforeEach(() => {
      mockedCapacitor.isNativePlatform.mockReturnValue(false);
    });

    it('initialize() is a no-op — never prompts for permission', async () => {
      const service = createService();
      await service.initialize();

      expect(mockedPushNotifications.requestPermissions).not.toHaveBeenCalled();
      expect(service.permissionState()).toBe('unknown');
      expect(service.token()).toBeNull();
    });
  });

  describe('on native', () => {
    beforeEach(() => {
      mockedCapacitor.isNativePlatform.mockReturnValue(true);
    });

    it('requests permission and registers when granted', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const service = createService();

      await service.initialize();

      expect(mockedPushNotifications.register).toHaveBeenCalled();
      expect(service.permissionState()).toBe('granted');
    });

    it('does not register when permission is denied, and records the denial', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'denied' });
      const service = createService();

      await service.initialize();

      expect(mockedPushNotifications.register).not.toHaveBeenCalled();
      expect(service.permissionState()).toBe('denied');
    });

    it('never prompts a second time, even after a denial', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'denied' });
      const service = createService();

      await service.initialize();
      await service.initialize();

      expect(mockedPushNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    });

    it('captures the token from a registration event', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const listeners = captureListeners();
      const service = createService();

      await service.initialize();
      listeners.get('registration')?.({ value: 'device-token-1' });

      expect(service.token()).toBe('device-token-1');
    });

    it('clears the token on a registration error', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const listeners = captureListeners();
      const service = createService();

      await service.initialize();
      listeners.get('registration')?.({ value: 'device-token-1' });
      listeners.get('registrationError')?.({});

      expect(service.token()).toBeNull();
    });

    it('records a tapped notification and clears it on acknowledgeTap()', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const listeners = captureListeners();
      const service = createService();
      await service.initialize();

      listeners.get('pushNotificationActionPerformed')?.({
        notification: { id: 'n1', data: { notificationId: 'abc' } },
      });

      expect(service.tapped()).toEqual({
        data: { notificationId: 'abc' },
        notification: { id: 'n1', data: { notificationId: 'abc' } },
      });

      service.acknowledgeTap();
      expect(service.tapped()).toBeNull();
    });

    it('records a foreground notification', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const listeners = captureListeners();
      const service = createService();
      await service.initialize();

      listeners.get('pushNotificationReceived')?.({ id: 'n2' });

      expect(service.foregroundNotification()).toEqual({ id: 'n2' });
    });

    it('reset() clears all state and unregisters natively after a successful initialize', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      captureListeners();
      const service = createService();
      await service.initialize();

      await service.reset();

      expect(mockedPushNotifications.removeAllListeners).toHaveBeenCalled();
      expect(mockedPushNotifications.unregister).toHaveBeenCalled();
      expect(service.token()).toBeNull();
      expect(service.tapped()).toBeNull();
      expect(service.foregroundNotification()).toBeNull();
      expect(service.permissionState()).toBe('unknown');
    });

    it('reset() is a cheap no-op if initialize() was never called', async () => {
      const service = createService();

      await service.reset();

      expect(mockedPushNotifications.removeAllListeners).not.toHaveBeenCalled();
      expect(mockedPushNotifications.unregister).not.toHaveBeenCalled();
    });

    it('allows initialize() to run again after reset() (e.g. a second login in the same session)', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const service = createService();

      await service.initialize();
      await service.reset();
      await service.initialize();

      expect(mockedPushNotifications.requestPermissions).toHaveBeenCalledTimes(2);
    });

    it('registers its cleanup with LogoutCleanupRegistry, which triggers reset()', async () => {
      mockedPushNotifications.requestPermissions.mockResolvedValue({ receive: 'granted' });
      const service = createService();
      await service.initialize();

      const registry = TestBed.inject(LogoutCleanupRegistry);
      registry.runAll();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockedPushNotifications.unregister).toHaveBeenCalled();
      expect(service.token()).toBeNull();
    });
  });
});
