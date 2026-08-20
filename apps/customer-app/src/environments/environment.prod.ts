import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Production build (`nx build customer-app --configuration=production`). */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-sg.onrender.com',
  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};