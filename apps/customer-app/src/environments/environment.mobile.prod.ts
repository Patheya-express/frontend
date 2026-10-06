import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Production native shell build (`nx build customer-app --configuration=mobile-production`, used by
 * `nx run customer-app:cap-sync --configuration=mobile-production` for release Android/iOS builds).
 * Calls the Production API (https://api.patheyaexpress.com) directly over HTTPS — never through
 * CloudFront. The QA-pointed `environment.mobile.ts` stays the development/QA device build.
 *
 * `razorpayKeyId` is a build-time placeholder: CI substitutes the live key ID (rzp_live_...) from
 * the RAZORPAY_LIVE_KEY_ID build secret via scripts/inject-production-env.mjs, and
 * scripts/verify-production-env.mjs fails any build where the placeholder or a test key remains.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://api.patheyaexpress.com',
  socketUrl: 'https://api.patheyaexpress.com',
  mediaBaseUrl: 'https://api.patheyaexpress.com',
  razorpayKeyId: 'REPLACE_WITH_RAZORPAY_LIVE_KEY_ID',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
  environmentName: 'production',
  releaseVersion: '1.0',
  sentryDsn: '',
};
