import { Injectable, inject } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { MobilePlatformService } from './mobile-platform.service';

/**
 * Semantic haptic feedback wrapper — every call site names *why* it's vibrating (`tap()`,
 * `success()`, …) rather than picking an `ImpactStyle`/`NotificationType` itself, so the actual
 * feel stays centrally tunable. A complete no-op on web (no vibration API call, no console noise)
 * so this is always safe to call from shared components without a platform check at the call site
 * — mirrors `provideMobilePlatform()`'s own "no-op on web" contract for StatusBar/SplashScreen/Keyboard.
 *
 * Deliberately isolated from UI components: components inject this service and call a named
 * method, never `@capacitor/haptics` directly — keeps every haptic decision in one place and
 * keeps components testable without a Capacitor runtime.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly mobilePlatform = inject(MobilePlatformService);

  /** Light tap — chip/tab selection, toggles, minor confirmations. */
  async tap(): Promise<void> {
    await this.run(() => Haptics.impact({ style: ImpactStyle.Light }));
  }

  /** Medium impact — primary actions: add to cart, place order, favorite toggle. */
  async action(): Promise<void> {
    await this.run(() => Haptics.impact({ style: ImpactStyle.Medium }));
  }

  /** Heavy impact — rare, deliberate emphasis (destructive confirm, pull-to-refresh release). */
  async impact(): Promise<void> {
    await this.run(() => Haptics.impact({ style: ImpactStyle.Heavy }));
  }

  /** Task completed successfully — order placed, payment confirmed. */
  async success(): Promise<void> {
    await this.run(() => Haptics.notification({ type: NotificationType.Success }));
  }

  /** Task failed — payment declined, form submit error. */
  async error(): Promise<void> {
    await this.run(() => Haptics.notification({ type: NotificationType.Warning }));
  }

  /** Value changed while dragging/scrubbing — quantity stepper, slider. */
  async selectionChanged(): Promise<void> {
    await this.run(() => Haptics.selectionChanged());
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (!this.mobilePlatform.isNative()) {
      return;
    }

    // Best-effort: a haptics failure (unsupported hardware, OS-level permission) should never
    // surface to the user or interrupt the action it's accompanying.
    try {
      await fn();
    } catch {
      // Intentionally swallowed — see comment above.
    }
  }
}
