import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Production build (`nx build customer-app --configuration=production`). */
export const environment: AppEnvironment = {
  production: true,
  // Production API origin — the host of the backend's production ingress
  // (patheya-express-platform k8s/overlays/production). Never the QA/Render origin.
  apiBaseUrl: 'https://api.patheyaexpress.com',
  socketUrl: 'https://api.patheyaexpress.com',
  mediaBaseUrl: 'https://api.patheyaexpress.com',
  // Razorpay LIVE key ID (public, not a secret — the key secret stays on the backend). This
  // placeholder deliberately blocks production builds via scripts/verify-production-env.mjs until
  // the real live key ID is committed; a Razorpay test key must never ship to production.
  razorpayKeyId: 'rzp_live_REPLACE_WITH_REAL_KEY',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
  environmentName: 'production',
  releaseVersion: '1.0',
  // Set to this app's real Sentry DSN before shipping. A DSN is a public, non-secret identifier
  // (see AppEnvironment.sentryDsn's doc comment) — safe to commit here.
  sentryDsn: '',
};
