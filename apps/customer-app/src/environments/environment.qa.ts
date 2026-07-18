import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * QA build (`nx build customer-app --configuration=qa`).
 * Replace these placeholder origins with the real QA deployment's values (Render backend URL) —
 * this file is deliberately not a secret and is safe to commit with the real QA origin.
 */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'https://replace-with-qa-backend-url',
  socketUrl: 'https://replace-with-qa-backend-url',
  mediaBaseUrl: 'https://replace-with-qa-backend-url',
  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
