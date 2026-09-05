import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Production build (`nx build customer-app --configuration=production`). */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
  environmentName: 'production',
  releaseVersion: '1.0',
  // Set to this app's real Sentry DSN before shipping. A DSN is a public, non-secret identifier
  // (see AppEnvironment.sentryDsn's doc comment) — safe to commit here.
  sentryDsn: '',
};
