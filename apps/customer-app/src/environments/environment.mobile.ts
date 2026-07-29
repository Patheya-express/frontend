import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Native shell build (`nx build customer-app --configuration=mobile`, used by
 * `cap sync`/`cap run`). A Capacitor Android/iOS shell — emulator or physical device — cannot
 * reach the host machine's `localhost`, so this points at the deployed QA origin instead of
 * local dev, the same way `environment.qa.ts` does. This file is deliberately not a secret.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  socketUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  mediaBaseUrl: 'https://patheya-express-api-gateway-qa.onrender.com',
  razorpayKeyId: 'rzp_test_Sop8avBtckAdw2',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
