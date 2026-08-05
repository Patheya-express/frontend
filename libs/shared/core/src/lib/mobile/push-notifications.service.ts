import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type PushNotificationSchema, type Token } from '@capacitor/push-notifications';
import { LogoutCleanupRegistry } from '@patheya-express-frontend/auth';

export interface PushNotificationTapped {
  data: unknown;
  notification: PushNotificationSchema;
}

/**
 * Client-side push notification foundation — no-op on web. Deliberately dumb: registers for push,
 * exposes the resulting token and incoming/tapped notifications as signals, and does nothing else.
 * It doesn't call the backend (the app decides when/how to POST the token — see
 * `notificationsControllerRegisterPushToken` in `@patheya-express-frontend/api-sdk`) and doesn't
 * navigate on tap (the app owns routing). This mirrors `RealtimeSocketService`/`HapticsService`'s
 * split: this library provides the native primitive, the app wires it to business logic.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly isNative = Capacitor.isNativePlatform();
  private initialized = false;

  private readonly _token = signal<string | null>(null);
  private readonly _tapped = signal<PushNotificationTapped | null>(null);
  private readonly _foregroundNotification = signal<PushNotificationSchema | null>(null);

  /** The device's current push token once registration succeeds. Null on web, or on native before
   *  registration completes/if the user denied permission. */
  readonly token = this._token.asReadonly();
  /** Set when the user taps a notification (from background or a killed-app cold launch). Treat as
   *  one-shot — call `acknowledgeTap()` once handled so an unrelated later read doesn't reprocess it. */
  readonly tapped = this._tapped.asReadonly();
  /** Set when a push arrives while the app is already in the foreground (no OS banner shown by
   *  default in that case) — the app decides what, if anything, to surface for this. */
  readonly foregroundNotification = this._foregroundNotification.asReadonly();

  constructor() {
    inject(LogoutCleanupRegistry).register(() => void this.reset());
  }

  /**
   * No-op on web. Requests notification permission and registers for push on native; safe to call
   * more than once (only the first call does anything). Resolves once listeners are attached and
   * `register()` has been requested — the token itself arrives asynchronously via the `token`
   * signal once the OS/FCM/APNs round-trip completes, not as this method's return value.
   */
  async initialize(): Promise<void> {
    if (!this.isNative || this.initialized) {
      return;
    }
    this.initialized = true;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      return;
    }

    await PushNotifications.addListener('registration', (token: Token) => {
      this._token.set(token.value);
    });

    await PushNotifications.addListener('registrationError', () => {
      this._token.set(null);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      this._foregroundNotification.set(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      this._tapped.set({ data: action.notification.data, notification: action.notification });
    });

    await PushNotifications.register();
  }

  acknowledgeTap(): void {
    this._tapped.set(null);
  }

  /**
   * Call on logout. Unregisters the device token natively (best-effort — deletes the FCM token on
   * Android, unregisters APNs on iOS) and clears local state so a stale token isn't reused for the
   * next login in the same session. Does NOT delete the token server-side: no backend endpoint
   * exists for that today (only `POST /notifications/push-token` to register one) — see Sprint 5's
   * report for this as a required server-side follow-up.
   */
  async reset(): Promise<void> {
    this._token.set(null);
    this._tapped.set(null);
    this._foregroundNotification.set(null);
    const wasInitialized = this.initialized;
    this.initialized = false;

    if (!this.isNative || !wasInitialized) {
      return;
    }

    try {
      await PushNotifications.removeAllListeners();
      await PushNotifications.unregister();
    } catch {
      // Best-effort — nothing meaningful to recover from a failed native unregister call.
    }
  }
}
