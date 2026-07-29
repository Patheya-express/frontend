import { Location } from '@angular/common';
import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { App } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { MobilePlatformService } from './mobile-platform.service';

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

      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
      await StatusBar.setStyle({ style: Style.Light });

      if (mobilePlatform.isAndroid()) {
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      }

      // Hardware back button (Android): mirror browser back navigation, exit the app once
      // there's no further app history to unwind — the standard native back-button contract.
      void App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          location.back();
        } else {
          void App.exitApp();
        }
      });

      // Defensive: `capacitor.config.ts` already sets `launchAutoHide: true`, but plugin config
      // can be overridden per-build, so hide explicitly too — `hide()` is a no-op if already hidden.
      await SplashScreen.hide();
    }),
  ]);
}
