import type { AppEnvironment } from '@patheya-express-frontend/core';

/** Production build (`nx build delivery-app --configuration=production`). */
export const environment: AppEnvironment = {
  production: true,
  // Production API origin — the host of the backend's production ingress
  // (patheya-express-platform k8s/overlays/production). Never the QA/Render origin.
  apiBaseUrl: 'https://api.patheyaexpress.com',
  socketUrl: 'https://api.patheyaexpress.com',
  mediaBaseUrl: 'https://api.patheyaexpress.com',
  razorpayKeyId: '',
  maps: { provider: 'GOOGLE_MAPS', googleMapsApiKey: '' },
  environmentName: 'production',
  releaseVersion: '1.0',
  sentryDsn: '',
};
