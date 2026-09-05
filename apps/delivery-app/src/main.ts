import { bootstrapApplication } from '@angular/platform-browser';
import {
  initMobileObservability,
  reportBootstrapFailure,
} from '@patheya-express-frontend/mobile-observability';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Runs before bootstrap (not through Angular DI) so a failure in bootstrapping itself — before any
// APP_INITIALIZER could ever run — is still captured. See initMobileObservability's own doc
// comment. No-ops entirely if this environment has no Sentry DSN configured yet.
initMobileObservability({
  app: 'delivery',
  environmentName: environment.environmentName ?? 'production',
  releaseVersion: environment.releaseVersion ?? 'unknown',
  dsn: environment.sentryDsn ?? '',
});

bootstrapApplication(App, appConfig).catch((err) => {
  reportBootstrapFailure(err);
  console.error(err);
});
