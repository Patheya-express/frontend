import { computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthFacade } from '@patheya-express-frontend/auth';
import {
  CurrentDeliveryPartnerService,
  CurrentDeliveryVerificationService,
  MobilePlatformService,
  PushNotificationsService,
  RealtimeSocketService,
} from '@patheya-express-frontend/core';
import { NotificationsService } from '@patheya-express-frontend/api-sdk';
import { ToastService } from '@patheya-express-frontend/ui';
import { App } from './app';

/**
 * Delivery app root — one logical alert per assignment no matter how many transports report it
 * (Socket.IO event, foreground push, tapped push), tap routing to the authoritative Assignments
 * screen, server-side push-token removal on logout, and the notifications-off hint.
 */
describe('App (delivery partner root)', () => {
  let fixture: ComponentFixture<App>;
  let socketHandlers: Map<string, (payload: unknown) => void>;
  let push: {
    token: ReturnType<typeof signal<string | null>>;
    tapped: ReturnType<typeof signal<{ data: unknown } | null>>;
    foregroundNotification: ReturnType<typeof signal<{ data: unknown } | null>>;
    permissionState: ReturnType<
      typeof signal<'unknown' | 'granted' | 'denied'>
    >;
    initialize: jest.Mock;
    acknowledgeTap: jest.Mock;
    createAndroidChannel: jest.Mock;
  };
  let router: { navigateByUrl: jest.Mock; navigate: jest.Mock; url: string };
  let notificationsApi: {
    notificationsControllerRegisterPushToken: jest.Mock;
    notificationsControllerUnregisterPushToken: jest.Mock;
  };
  let authLogout: jest.Mock;
  let toast: ToastService;
  let snackbar: jest.SpyInstance;

  const OFFER = {
    type: 'delivery.assignment',
    assignmentId: 'assignment-1',
    orderId: 'order-1',
  };

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    socketHandlers = new Map();
    push = {
      token: signal<string | null>(null),
      tapped: signal<{ data: unknown } | null>(null),
      foregroundNotification: signal<{ data: unknown } | null>(null),
      permissionState: signal<'unknown' | 'granted' | 'denied'>('unknown'),
      initialize: jest.fn().mockResolvedValue(undefined),
      acknowledgeTap: jest.fn(() => push.tapped.set(null)),
      createAndroidChannel: jest.fn().mockResolvedValue(undefined),
    };
    router = {
      navigateByUrl: jest.fn().mockResolvedValue(true),
      navigate: jest.fn(),
      url: '/dashboard',
    };
    notificationsApi = {
      notificationsControllerRegisterPushToken: jest
        .fn()
        .mockResolvedValue(undefined),
      notificationsControllerUnregisterPushToken: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    const accessToken = signal<string | null>('access-token');
    authLogout = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: AuthFacade,
          useValue: {
            user: signal({
              id: 'rider-1',
              firstName: 'Ravi',
              lastName: 'K',
              role: 'DELIVERY_PARTNER',
            }),
            isAuthenticated: computed(() => !!accessToken()),
            sessionExpired: signal(false),
            acknowledgeSessionExpiry: jest.fn(),
            logout: authLogout,
          },
        },
        { provide: Router, useValue: router },
        {
          provide: RealtimeSocketService,
          useValue: {
            on: jest.fn(
              (event: string, handler: (payload: unknown) => void) => {
                socketHandlers.set(event, handler);
                return () => undefined;
              },
            ),
            joinRoom: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: CurrentDeliveryPartnerService,
          useValue: { getPartner: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: CurrentDeliveryVerificationService,
          useValue: {
            getVerification: jest.fn().mockResolvedValue(null),
            invalidate: jest.fn(),
          },
        },
        {
          provide: MobilePlatformService,
          useValue: { isNative: () => false, platform: signal('web') },
        },
        { provide: PushNotificationsService, useValue: push },
        { provide: NotificationsService, useValue: notificationsApi },
      ],
    });
    TestBed.overrideComponent(App, { set: { template: '', imports: [] } });

    toast = TestBed.inject(ToastService);
    snackbar = jest.spyOn(toast, 'showSnackbar');
    fixture = TestBed.createComponent(App);
    await settle();
  });

  function offerSnackbars(): number {
    return snackbar.mock.calls.filter(([config]) =>
      String((config as { message: string }).message).startsWith(
        'New delivery assigned',
      ),
    ).length;
  }

  it('joins the partner user room so offers reach the app', () => {
    const realtime = TestBed.inject(RealtimeSocketService) as unknown as {
      joinRoom: jest.Mock;
    };
    expect(realtime.joinRoom).toHaveBeenCalledWith('user:rider-1');
  });

  it('alerts once per assignment even if the socket event is delivered twice', async () => {
    socketHandlers.get('delivery.assignment')?.({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
    });
    socketHandlers.get('delivery.assignment')?.({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
    });
    await settle();

    expect(offerSnackbars()).toBe(1);
  });

  it('does not alert again when a foreground push arrives for an offer the socket already reported', async () => {
    socketHandlers.get('delivery.assignment')?.({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
    });
    push.foregroundNotification.set({ data: OFFER });
    await settle();

    expect(offerSnackbars()).toBe(1);
  });

  it('alerts for a foreground push when the socket was not connected', async () => {
    push.foregroundNotification.set({
      data: { ...OFFER, assignmentId: 'assignment-2' },
    });
    await settle();

    expect(offerSnackbars()).toBe(1);
  });

  it('ignores foreground pushes that are not assignment offers', async () => {
    push.foregroundNotification.set({ data: { type: 'notification' } });
    await settle();

    expect(offerSnackbars()).toBe(0);
  });

  it('routes a tapped offer push to Assignments (which re-fetches it) and suppresses a later duplicate alert', async () => {
    push.tapped.set({ data: OFFER });
    await settle();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/assignments');
    expect(push.acknowledgeTap).toHaveBeenCalled();

    socketHandlers.get('delivery.assignment')?.({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
    });
    await settle();
    expect(offerSnackbars()).toBe(0);
  });

  it('removes the device token from the account before logging out', async () => {
    push.token.set('fcm-token-1');
    await settle();

    await (
      fixture.componentInstance as unknown as { onLogout(): Promise<void> }
    ).onLogout();

    expect(
      notificationsApi.notificationsControllerUnregisterPushToken,
    ).toHaveBeenCalledWith({
      body: { token: 'fcm-token-1' },
    });
    const unregisterOrder =
      notificationsApi.notificationsControllerUnregisterPushToken.mock
        .invocationCallOrder[0];
    expect(unregisterOrder).toBeLessThan(
      authLogout.mock.invocationCallOrder[0],
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('still logs out when removing the token fails', async () => {
    push.token.set('fcm-token-1');
    notificationsApi.notificationsControllerUnregisterPushToken.mockRejectedValue(
      new Error('offline'),
    );
    await settle();

    await (
      fixture.componentInstance as unknown as { onLogout(): Promise<void> }
    ).onLogout();

    expect(authLogout).toHaveBeenCalled();
  });

  it('warns once when notification permission is denied', async () => {
    push.permissionState.set('denied');
    await settle();

    expect(snackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Notifications are off'),
      }),
    );
  });
});
