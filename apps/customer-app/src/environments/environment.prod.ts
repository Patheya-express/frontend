import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Production build (`nx build customer-app --configuration=production`).
 * `razorpayKeyId` is a public key (safe to ship client-side) — replace it with the real live
 * Razorpay key before the first production deploy. `apiBaseUrl`/`socketUrl`/`mediaBaseUrl`
 * must point at the real production API origin.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://api.patheyaexpress.com',
  socketUrl: 'https://api.patheyaexpress.com',
  mediaBaseUrl: 'https://api.patheyaexpress.com',
  razorpayKeyId: 'rzp_live_REPLACE_WITH_REAL_KEY',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
};
