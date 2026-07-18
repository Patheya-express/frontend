import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ApiConfiguration } from '@patheya-express-frontend/api-sdk';
import { AuthFacade, authInterceptor } from '@patheya-express-frontend/auth';
import { APP_ENVIRONMENT } from '@patheya-express-frontend/core';
import { CartFacade } from '@patheya-express-frontend/cart';
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
    // Cart is now backend-authenticated (GET /cart requires a JWT), so it must only be restored
    // once we know a session exists — otherwise every guest page load 401s against it.
    provideAppInitializer(() => {
      const authFacade = inject(AuthFacade);
      authFacade.initialize();

      if (authFacade.isAuthenticated()) {
        return inject(CartFacade).restore();
      }

      return undefined;
    }),
  ]
};
