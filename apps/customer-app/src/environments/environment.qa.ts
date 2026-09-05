import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * QA build (`nx build customer-app --configuration=qa`).
 * Replace these placeholder origins with the real QA deployment's values (Render backend URL) —
 * this file is deliberately not a secret and is safe to commit with the real QA origin.
 */

export const environment: AppEnvironment = {
  production: true,

  apiBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',

  socketUrl: 'https://patheya-express-api-gateway-sg.onrender.com',

  mediaBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',

  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',

  maps: {
    provider: 'GOOGLE_MAPS',
    googleMapsApiKey: '',
  },

  environmentName: 'qa',
  releaseVersion: '1.0',
  // Set to this app's real Sentry DSN before relying on QA crash reports. A DSN is a public,
  // non-secret identifier (see AppEnvironment.sentryDsn's doc comment) — safe to commit here.
  sentryDsn: '',
};
