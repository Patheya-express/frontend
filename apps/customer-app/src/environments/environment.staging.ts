import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Staging build (`nx build customer-app --configuration=staging`).
 * Replace these placeholder origins with the real staging deployment's values —
 * this file is deliberately not a secret and is safe to commit with the real staging origin.
 */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'https://api-staging.patheyaexpress.com',
  socketUrl: 'https://api-staging.patheyaexpress.com',
  mediaBaseUrl: 'https://api-staging.patheyaexpress.com',
  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
