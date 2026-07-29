import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export type MobilePlatform = 'android' | 'ios' | 'web';

/**
 * Single source of truth for "what shell is this app running in" — every native-vs-web branch
 * (StatusBar/SplashScreen/Keyboard setup, safe-area classes, platform-specific UX) should read
 * this instead of touching `Capacitor.*` directly, so the native check stays mockable/testable
 * and consistent across customer-app, restaurant-app and delivery-app.
 */
@Injectable({ providedIn: 'root' })
export class MobilePlatformService {
  private readonly currentPlatform = signal<MobilePlatform>(this.resolvePlatform());

  /** Reactive platform id — recompute-safe since it's a signal, though it never changes post-boot. */
  readonly platform = this.currentPlatform.asReadonly();

  isAndroid(): boolean {
    return this.currentPlatform() === 'android';
  }

  isIOS(): boolean {
    return this.currentPlatform() === 'ios';
  }

  isWeb(): boolean {
    return this.currentPlatform() === 'web';
  }

  /** True inside the Capacitor Android/iOS shell; false in a browser tab, mobile or desktop. */
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  private resolvePlatform(): MobilePlatform {
    const platform = Capacitor.getPlatform();
    return platform === 'android' || platform === 'ios' ? platform : 'web';
  }
}
