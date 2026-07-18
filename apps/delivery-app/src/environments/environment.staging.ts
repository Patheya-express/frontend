import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Staging build (`nx build delivery-app --configuration=staging`). */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'https://api-staging.patheyaexpress.com',
  socketUrl: 'https://api-staging.patheyaexpress.com',
  mediaBaseUrl: 'https://api-staging.patheyaexpress.com',
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
