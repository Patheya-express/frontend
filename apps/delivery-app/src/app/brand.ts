/**
 * The single source of the delivery app's product-facing name. Native display names
 * (android `strings.xml`, iOS `Info.plist`, `capacitor.config.ts`) and `index.html`'s <title> are
 * static files that can't import this, so they repeat the same literal — keep them in sync.
 * Internal identifiers (`com.patheyaexpress.delivery`, the `delivery-app` project name, API routes,
 * `CourierLocationService`, …) are deliberately not product branding and stay as they are.
 */
export const DELIVERY_PARTNER_BRAND_NAME = 'Patheya Delivery Partner';
