import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ApiConfiguration } from '@patheya-express-frontend/api-sdk';
import { AuthFacade, authInterceptor } from '@patheya-express-frontend/auth';
import { APP_ENVIRONMENT, provideMobilePlatform } from '@patheya-express-frontend/core';
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
    provideAppInitializer(() => {
      inject(AuthFacade).initialize();
    }),
  ]
};
