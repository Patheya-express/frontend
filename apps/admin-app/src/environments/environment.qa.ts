import type { AppEnvironment } from '@patheya-express-frontend/core';

/** QA build (`nx build admin-app --configuration=qa`). */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  // Admin App never initiates a Razorpay checkout — not used, kept empty.
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
