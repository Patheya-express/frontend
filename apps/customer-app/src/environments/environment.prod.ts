import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Production build (`nx build customer-app --configuration=production`), served from S3 +
 * CloudFront: the customer web build (secondary channel; the Capacitor app is primary).
 * Calls the Production API on AWS (ECS Fargate behind the public ALB) directly.
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
