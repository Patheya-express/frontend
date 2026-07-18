import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Local development — selected by default (no file replacement) by `nx serve restaurant-app`. */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000',
  mediaBaseUrl: 'http://localhost:3000',
  // Restaurant App never initiates a Razorpay checkout — not used, kept empty.
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: 'AIzaSyCbp27jnxrEf4tHQqx3o1dMMRTXtsKO2Xg' },
};
