import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Production build (`nx build restaurant-app --configuration=production`). */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
