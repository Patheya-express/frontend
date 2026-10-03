import type { AppEnvironment } from '@patheya-express-frontend/core';

/**
 * Production build (`nx build delivery-app --configuration=production`), served from S3 +
 * CloudFront: the delivery web build (secondary channel; the Capacitor app is primary).
 * Calls the Production API on AWS (ECS Fargate behind the public ALB) directly.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: 'https://api.patheyaexpress.com',
  socketUrl: 'https://api.patheyaexpress.com',
  mediaBaseUrl: 'https://api.patheyaexpress.com',
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
  environmentName: 'production',
  releaseVersion: '1.0',
  sentryDsn: '',
};
