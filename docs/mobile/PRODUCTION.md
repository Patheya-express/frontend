# Production mobile configuration

The Customer, Restaurant and Delivery Capacitor apps are Patheya Express's **primary** channel.
In Production they call the AWS-hosted API directly — `https://api.patheyaexpress.com` (public ALB,
AWS WAF, ECS Fargate) — for both REST and the websocket-only Socket.IO connection. They are never
routed through CloudFront; CloudFront serves only the admin and secondary web builds.

## Build configurations

| Configuration | Environment file | Backend | Use |
|---|---|---|---|
| `mobile` | `environment.mobile.ts` | QA (Render) | development / QA device builds — unchanged |
| `mobile-production` | `environment.mobile.prod.ts` | Production (`api.patheyaexpress.com`) | store release builds |

Release build (from a clean checkout of the release tag):

```bash
pnpm install --frozen-lockfile
RAZORPAY_LIVE_KEY_ID=rzp_live_... pnpm inject:prod-env   # customer-app only uses it
pnpm verify:prod-env                                     # fails on placeholders, localhost, test keys
pnpm mobile:sync:production                              # nx build + cap sync, mobile-production
# then open Android Studio / Xcode per app and produce the signed AAB / IPA
```

`inject:prod-env` edits the checkout's environment files in place — run it only in a disposable
checkout (CI, or a release clone), never commit the result.

## Backend requirements already in place

- CORS: Production's `EXTRA_ALLOWED_ORIGINS` contains `https://localhost` (Android,
  `androidScheme: 'https'`) and `capacitor://localhost` (iOS); both the REST API and the realtime
  gateway honor it.
- Realtime: the client uses `transports: ['websocket']`, and the API fans events out through the
  Socket.IO Redis adapter, so the ALB needs no sticky sessions across ECS tasks.

## Launch follow-ups — NOT implemented (no credentials were invented)

1. **Push notifications.** `@capacitor/push-notifications` is installed, but the backend has no
   FCM/APNs sender, only `customer-app/android` has a `google-services.json`, and no iOS APNs key
   or `GoogleService-Info.plist` exists. Needed: a Firebase project per app (or one project, three
   apps), APNs auth key, device-token registration endpoint, and a backend sender (worker job).
2. **Deep links.** Only the custom `patheyaexpress://` scheme exists (Android intent filter), and
   it is preserved. Verified Android App Links and iOS Universal Links need
   `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` served from a
   Production domain, `autoVerify` intent filters and iOS associated-domain entitlements — none
   exist yet.
3. **Signing and store pipeline.** No CI job produces signed AAB/IPA artifacts; release builds are
   manual (above). Keystore / signing-certificate custody must be decided before automating.
4. **Production keys.** `maps.googleMapsApiKey` and `sentryDsn` are empty in
   `environment.mobile.prod.ts`; set them (both are public identifiers) once the Production Google
   Maps key (restricted to the app IDs) and Sentry projects exist.
5. **Versioning.** `releaseVersion` is hand-synced with `build.gradle` / Xcode, as before.
