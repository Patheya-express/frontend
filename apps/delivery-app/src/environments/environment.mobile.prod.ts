import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Production native shell build (`nx build delivery-app --configuration=mobile-production`, used by
 * `nx run delivery-app:cap-sync --configuration=mobile-production` for release Android/iOS builds).
 * Calls the Production API (https://api.patheyaexpress.com) directly over HTTPS — never through
 * CloudFront. The QA-pointed `environment.mobile.ts` stays the development/QA device build.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://api.patheyaexpress.com',
  socketUrl: 'https://api.patheyaexpress.com',
  mediaBaseUrl: 'https://api.patheyaexpress.com',
  // Delivery App never initiates a Razorpay checkout — not used, kept empty.
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
  environmentName: 'production',
  releaseVersion: '1.0',
  sentryDsn: '',
};
