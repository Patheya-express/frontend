import type { AppEnvironment } from '@patheya-express-frontend/core';

/** QA build (`nx build admin-app --configuration=qa`). */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'https://replace-with-qa-backend-url',
  socketUrl: 'https://replace-with-qa-backend-url',
  mediaBaseUrl: 'https://replace-with-qa-backend-url',
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
