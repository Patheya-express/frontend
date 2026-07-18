import type { AppEnvironment } from '@patheya-express-frontend/core';

/** QA build (`nx build restaurant-app --configuration=qa`). */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  // Restaurant App never initiates a Razorpay checkout — not used, kept empty.
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
