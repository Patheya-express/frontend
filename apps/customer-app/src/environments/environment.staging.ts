import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Staging build (`nx build customer-app --configuration=staging`). Origin is the backend's staging
 * ingress host (patheya-express-platform k8s/overlays/staging) — never the QA or production origin.
 */

export const environment: AppEnvironment = {
  production: true,

  apiBaseUrl: 'https://api.staging.patheyaexpress.com',

  socketUrl: 'https://api.staging.patheyaexpress.com',

  mediaBaseUrl: 'https://api.staging.patheyaexpress.com',

  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',

  maps: {
    provider: 'GOOGLE_MAPS',
    googleMapsApiKey: '',
  },

  environmentName: 'staging',
  releaseVersion: '1.0',
  // Set to this app's real Sentry DSN before this environment is actually deployed to.
  sentryDsn: '',
};
