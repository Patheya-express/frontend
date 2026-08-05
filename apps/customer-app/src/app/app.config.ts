import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ApiConfiguration } from '@patheya-express-frontend/api-sdk';
import { AuthFacade, authInterceptor } from '@patheya-express-frontend/auth';
import { APP_ENVIRONMENT, BACK_BUTTON_OVERLAY_HANDLER, provideMobilePlatform } from '@patheya-express-frontend/core';
import { BottomSheetService, DialogService, ModalService } from '@patheya-express-frontend/ui';
import { provideAddressProvider } from '@patheya-express-frontend/map-picker';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: APP_ENVIRONMENT, useValue: environment },
    provideAddressProvider(),
    provideMobilePlatform(),
    // Real implementation of the token `provideMobilePlatform()`'s hardware back-button handler
    // uses to close an open overlay instead of navigating the route underneath it — see that
    // token's own doc comment for why this can't live in `core` itself (module-boundary
    // direction). Modal/BottomSheet/Dialog each track their own stack independently with no
    // shared ordering between the three kinds, so this checks each in turn (dialog first, as the
    // most typically-blocking kind) rather than a true "most recently opened of any kind" — a
    // reasonable approximation given this app only ever has one overlay kind open at a time in
    // practice, not a precise cross-stack timestamp.
    {
      provide: BACK_BUTTON_OVERLAY_HANDLER,
      useFactory: () => {
        const dialogService = inject(DialogService);
        const bottomSheetService = inject(BottomSheetService);
        const modalService = inject(ModalService);

        return (): boolean => {
          for (const service of [dialogService, bottomSheetService, modalService]) {
            const entries = service.entries();
            const topmost = entries[entries.length - 1];
            if (topmost) {
              service.close(topmost.id);
              return true;
            }
          }
          return false;
        };
      },
    },
    {
      provide: ApiConfiguration,
      useFactory: () => {
        const config = new ApiConfiguration();
        // The generated SDK's operation paths already include NestJS's global `/api/v1` prefix,
        // so this must stay a bare origin.
        config.rootUrl = environment.apiBaseUrl;
        return config;
      },
    },
    // Session restore itself is synchronous (reads localStorage — see AuthStore.initialize()),
    // so this still blocks bootstrap only as long as that takes: effectively instant. Route
    // guards (authGuard/guestGuard) can therefore rely on AuthFacade.isAuthenticated() being
    // correct from the very first navigation.
    //
    // Cart restore (the one *async*/network part of startup) is deliberately NOT here — it's
    // already handled by `App`'s own constructor `effect()` (`app.ts`), which fires as soon as
    // `isAuthenticated()` is true, cold-launch-with-existing-session or fresh-login alike.
    // Registering it again via `SPLASH_INITIALIZERS` (`@patheya-express-frontend/auth-ui`) would
    // restore the cart twice on cold launch; that token is available here for genuinely new
    // app-specific startup work in the future, none is needed today.
    provideAppInitializer(async () => {
      const authFacade = inject(AuthFacade);
      // No-op on web; on native this awaits the Keychain/Keystore read into AuthStorageService's
      // in-memory cache before initialize() does its normal synchronous load() — see
      // AuthStorageService's doc comment.
      await authFacade.hydrateNativeSession();
      authFacade.initialize();
    }),
  ]
};
