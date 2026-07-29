import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Native shell build (`nx build restaurant-app --configuration=mobile`, used by
 * `cap sync`/`cap run`). A Capacitor Android/iOS shell — emulator or physical device — cannot
 * reach the host machine's `localhost`, so this points at the deployed QA origin instead of
 * local dev, the same way `environment.qa.ts` does. This file is deliberately not a secret.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  // Restaurant App never initiates a Razorpay checkout — not used, kept empty.
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
