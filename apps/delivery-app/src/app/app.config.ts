import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ApiConfiguration } from '@patheya-express-frontend/api-sdk';
import { AuthFacade, authInterceptor } from '@patheya-express-frontend/auth';
import {
  APP_ENVIRONMENT,
  provideMobilePlatform,
} from '@patheya-express-frontend/core';
import {
  cancellationInterceptor,
  correlationIdInterceptor,
  httpTimeoutInterceptor,
} from '@patheya-express-frontend/mobile-networking';
import {
  networkErrorReportingInterceptor,
  provideMobileObservability,
} from '@patheya-express-frontend/mobile-observability';
import { provideAddressProvider } from '@patheya-express-frontend/map-picker';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Order matters (see each interceptor's own doc comment): correlationIdInterceptor first so
    // its X-Request-Id survives authInterceptor's clone-based retry as one stable ID per logical
    // request; authInterceptor next, unchanged; httpTimeoutInterceptor after auth so the original
    // attempt and any post-refresh retry each get their own timeout window rather than sharing
    // one budget; cancellationInterceptor next, closest to the backend; networkErrorReportingInterceptor
    // (M7) last of all so it observes the raw error before anything else's catchError runs, then
    // rethrows it completely unchanged — see that interceptor's own doc comment.
    provideHttpClient(
      withInterceptors([
        correlationIdInterceptor,
        authInterceptor,
        httpTimeoutInterceptor,
        cancellationInterceptor,
        networkErrorReportingInterceptor,
      ]),
    ),
    { provide: APP_ENVIRONMENT, useValue: environment },
    provideAddressProvider(),
    provideMobilePlatform(),
    provideMobileObservability(environment.environmentName ?? 'production'),
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
    provideAppInitializer(() => inject(AuthFacade).initialize()),
  ],
};
