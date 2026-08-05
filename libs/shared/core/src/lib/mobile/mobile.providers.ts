import { Location } from '@angular/common';
import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BACK_BUTTON_OVERLAY_HANDLER } from './back-button-overlay-handler.token';
import { MobilePlatformService } from './mobile-platform.service';

/**
 * `patheyaexpress://restaurants/abc123` parses via `new URL()` with `hostname: 'restaurants'` and
 * `pathname: '/abc123'` — custom schemes have no real host, so the first path segment lands there
 * instead of in `pathname`. Reassembling `/${hostname}${pathname}` recovers the route Angular's
 * Router actually expects (`/restaurants/abc123`), matching `app.routes.ts` exactly.
 */
function toRouterPath(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const path = `/${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/\/+/g, '/');
    return path === '/' ? undefined : path;
  } catch {
    return undefined;
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

      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
      await StatusBar.setStyle({ style: Style.Light });

      if (mobilePlatform.isAndroid()) {
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
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
      // through the existing Router, not a separate native screen.
      void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        const path = toRouterPath(event.url);
        if (path) {
          void router.navigateByUrl(path);
        }
      });

      // Defensive: `capacitor.config.ts` already sets `launchAutoHide: true`, but plugin config
      // can be overridden per-build, so hide explicitly too — `hide()` is a no-op if already hidden.
      await SplashScreen.hide();
    }),
  ]);
}
