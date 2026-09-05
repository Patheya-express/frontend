import { Location } from '@angular/common';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { validateDeepLink } from '@patheya-express-frontend/mobile-security';
import { BACK_BUTTON_OVERLAY_HANDLER } from './back-button-overlay-handler.token';
import { MobilePlatformService } from './mobile-platform.service';

/**
 * Runs an optional platform convenience (resize mode, status bar styling, hiding a splash screen
 * `capacitor.config.ts` already auto-hides) — never lets it block bootstrap. A given Capacitor
 * plugin method can be a native no-op/unimplemented stub on a given platform/version (e.g.
 * `@capacitor/keyboard@8.0.5`'s Android `setResizeMode` rejects unconditionally) without that
 * being a real application error; since this runs inside `provideAppInitializer`, an unhandled
 * rejection here would otherwise reject `bootstrapApplication()` itself and leave `<app-root>`
 * permanently empty. Mirrors `HapticsService`'s "intentionally swallowed" best-effort pattern.
 */
async function bestEffort(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Intentionally swallowed — see doc comment above.
  }
}

/**
 * Enterprise mobile bootstrap for the Capacitor shell — the standalone-provider equivalent of a
 * "MobileModule" (this codebase is fully standalone/signals-based with no NgModules, so a real
 * NgModule would be an architectural regression; this mirrors the existing `provideRouter` /
 * `provideAddressProvider` idiom instead). Wires StatusBar, SplashScreen, Keyboard and the
 * hardware back button once at app start, and is a complete no-op on web. Add once to each
 * mobile-enabled app's `app.config.ts` providers array.
 */
export function provideMobilePlatform(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      const mobilePlatform = inject(MobilePlatformService);

      if (!mobilePlatform.isNative()) {
        return;
      }

      const location = inject(Location);
      const router = inject(Router);
      const closeTopOverlay = inject(BACK_BUTTON_OVERLAY_HANDLER);

      await bestEffort(() =>
        Keyboard.setResizeMode({ mode: KeyboardResize.Body }),
      );
      await bestEffort(() => StatusBar.setStyle({ style: Style.Light }));

      if (mobilePlatform.isAndroid()) {
        await bestEffort(() =>
          StatusBar.setBackgroundColor({ color: '#ffffff' }),
        );
      }

      // Hardware back button (Android): if a modal/bottom-sheet/dialog is open on top of the
      // current route, close that first — otherwise the route navigates away underneath it,
      // leaving the overlay orphaned or unexpectedly kicking the user back a full screen instead
      // of just dismissing what they were actually looking at. Only when nothing was closed does
      // this fall through to the standard back-navigation contract: mirror browser back, exit the
      // app once there's no further app history to unwind.
      void App.addListener('backButton', ({ canGoBack }) => {
        if (closeTopOverlay()) {
          return;
        }

        if (canGoBack) {
          location.back();
        } else {
          void App.exitApp();
        }
      });

      // Deep links (patheyaexpress://…, registered in AndroidManifest.xml / Info.plist) — routed
      // through the existing Router, not a separate native screen. The Android intent-filter for
      // this scheme has no host/path restriction, so the OS will hand this listener literally any
      // `patheyaexpress://…` URI; `validateDeepLink` (libs/shared/mobile-security) is the security
      // boundary that decides what's actually safe to navigate to before anything reaches the
      // Router — see its doc comment for the allow-list this enforces.
      void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        const result = validateDeepLink(event.url);
        if (result.allowed) {
          void router.navigateByUrl(result.routerPath);
        }
      });

      // Defensive: `capacitor.config.ts` already sets `launchAutoHide: true`, but plugin config
      // can be overridden per-build, so hide explicitly too — `hide()` is a no-op if already hidden.
      await bestEffort(() => SplashScreen.hide());
    }),
  ]);
}
