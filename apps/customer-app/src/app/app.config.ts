import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ApiConfiguration } from '@patheya-express-frontend/api-sdk';
import { AuthFacade, authInterceptor } from '@patheya-express-frontend/auth';
import { CartFacade } from '@patheya-express-frontend/cart';
import { routes } from './app.routes';

// TODO: move to environment-based configuration once build-time environment files are introduced.
// Bare origin only: the generated SDK's operation paths already include NestJS's global `/api/v1` prefix.
const API_ROOT_URL = 'http://localhost:3000';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: ApiConfiguration,
      useFactory: () => {
        const config = new ApiConfiguration();
        config.rootUrl = API_ROOT_URL;
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
