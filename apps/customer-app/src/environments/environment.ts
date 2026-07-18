import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Local development — selected by default (no file replacement) by `nx serve customer-app`. */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000',
  mediaBaseUrl: 'http://localhost:3000',
  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: 'AIzaSyCbp27jnxrEf4tHQqx3o1dMMRTXtsKO2Xg' },
};
