# Mobile Foundation — Capacitor (Phase 1)

Converts `customer-app`, `restaurant-app` and `delivery-app` into installable Android/iOS apps by
wrapping the existing Angular web builds in a Capacitor native shell. No backend changes, no
business-logic changes, no new UI — this is packaging + platform plumbing only.

> **Naming note**: the Phase 1 brief referred to the restaurant-facing app as `partner-app`. This
> workspace's actual project is `restaurant-app` — it is the restaurant-partner application, so it
> was treated as the "partner" target throughout (app id `com.patheyaexpress.partner`, app name
> "Patheya Express Partner"). `admin-app` was left untouched — web only, per the brief.

## 1. Architecture explanation

- **One Capacitor project per app**, rooted at `apps/<app>/`, not a separate mobile app. Each
  app's `capacitor.config.ts` sets `webDir` to that same app's existing Angular build output
  (`dist/apps/<app>/browser`). The native shell just loads the already-built web app — nothing
  about `AuthFacade`, the generated SDK, Socket.IO, or any feature library changed.
- **`android/` and `ios/` live inside each app folder**, not at the workspace root, because there
  are three independently-branded native shells (different app id, name, icon, splash per app),
  not one. This is the standard pattern for Capacitor-in-an-Nx-monorepo (each app is its own
  Capacitor project; `@capacitor/core`/CLI/platform packages are shared, installed once at the
  workspace root).
- **`MobilePlatformService`** (`libs/shared/core/src/lib/mobile/mobile-platform.service.ts`) is
  the single source of truth for "what shell is this". It wraps `Capacitor.getPlatform()` /
  `Capacitor.isNativePlatform()` behind Angular signals (`isAndroid()`, `isIOS()`, `isNative()`,
  `isWeb()`, `platform()`), so no app or feature library ever imports `@capacitor/core` directly.
- **No `MobileModule` (NgModule)** was created. This codebase is fully standalone-component /
  signals-based (`bootstrapApplication`, `provideRouter`, `provideAddressProvider`, …) with zero
  NgModules anywhere — introducing one now would be an architectural regression, not a foundation.
  Instead, `provideMobilePlatform()` (`libs/shared/core/src/lib/mobile/mobile.providers.ts`) is
  the enterprise mobile bootstrap, following the exact same `provideXxx()` idiom already used by
  every other cross-cutting concern in `app.config.ts`. It configures StatusBar, SplashScreen,
  Keyboard resize behaviour and the Android hardware back button once at app start, and is a
  complete no-op on web (`mobilePlatform.isNative()` guard) — so `nx serve`/browser usage is
  unaffected.
- **Environment switching** reuses the existing per-app `environments/*.ts` + Angular
  `fileReplacements` pattern (`environment.ts` / `.staging.ts` / `.qa.ts` / `.prod.ts`) — a new
  `environment.mobile.ts` + `mobile` build configuration was added alongside them, for one reason:
  a native shell (emulator or physical device) cannot resolve the host machine's `localhost`, so
  it needs a real reachable origin. It points at the same QA origin `environment.qa.ts` already
  uses. Nothing about the environment *mechanism* changed.
- **Safe-area and viewport** are additive-only: `viewport-fit=cover` was added to each mobile
  app's `index.html` (harmless on web/desktop) and a set of opt-in `--safe-area-*` CSS custom
  properties + `.safe-area-*` utility classes were added to the shared `theme.scss` (used by all
  four apps). Nothing is applied automatically to existing layouts — `env(safe-area-inset-*)`
  resolves to `0px` on any browser that doesn't support it, so this cannot change existing web
  rendering; picking them up in shell chrome (headers/tab bars) is left to whoever builds that UI.

## 2. Files created

```
apps/customer-app/capacitor.config.ts
apps/customer-app/src/environments/environment.mobile.ts
apps/customer-app/android/                          (generated native Android project)
apps/customer-app/ios/                               (generated native Xcode project)
apps/customer-app/android/keystore.properties.example
apps/customer-app/ios/exportOptions.plist.example

apps/restaurant-app/capacitor.config.ts               (appId com.patheyaexpress.partner)
apps/restaurant-app/src/environments/environment.mobile.ts
apps/restaurant-app/android/
apps/restaurant-app/ios/
apps/restaurant-app/android/keystore.properties.example
apps/restaurant-app/ios/exportOptions.plist.example

apps/delivery-app/capacitor.config.ts
apps/delivery-app/src/environments/environment.mobile.ts
apps/delivery-app/android/
apps/delivery-app/ios/
apps/delivery-app/android/keystore.properties.example
apps/delivery-app/ios/exportOptions.plist.example

libs/shared/core/src/lib/mobile/mobile-platform.service.ts
libs/shared/core/src/lib/mobile/mobile.providers.ts

docs/mobile/CAPACITOR.md                              (this file)
```

## 3. Files modified

```
package.json                          + @capacitor/* deps, mobile:* scripts
pnpm-lock.yaml                        + lockfile update
.gitignore                            + native build output / signing-secret ignores
libs/shared/core/src/index.ts         + export mobile-platform.service, mobile.providers
libs/shared/ui/src/theme.scss         + --safe-area-* tokens, .safe-area-* utility classes

apps/customer-app/project.json        + "mobile" build/serve config, cap-sync/cap-open-* targets
apps/customer-app/src/index.html      viewport-fit=cover
apps/customer-app/src/app/app.config.ts   + provideMobilePlatform()

apps/restaurant-app/project.json      (same three changes as customer-app)
apps/restaurant-app/src/index.html
apps/restaurant-app/src/app/app.config.ts

apps/delivery-app/project.json        (same three changes as customer-app)
apps/delivery-app/src/index.html
apps/delivery-app/src/app/app.config.ts
```

`admin-app` was not touched anywhere — it stays web-only per the brief.

## 4. Folder structure

```
apps/
  customer-app/
    capacitor.config.ts
    android/                 ← native Android Studio / Gradle project (committed)
    ios/                     ← native Xcode project (committed)
    src/environments/environment.mobile.ts
  restaurant-app/            ← "partner" native shell (com.patheyaexpress.partner)
    capacitor.config.ts
    android/
    ios/
    src/environments/environment.mobile.ts
  delivery-app/
    capacitor.config.ts
    android/
    ios/
    src/environments/environment.mobile.ts
  admin-app/                 ← unchanged, web only

libs/shared/core/src/lib/mobile/
  mobile-platform.service.ts   ← isAndroid()/isIOS()/isNative()/isWeb()/platform() signals
  mobile.providers.ts          ← provideMobilePlatform()
```

`android/` and `ios/` are committed (same convention as React Native/Capacitor projects generally
— they hold platform-specific config, icons, permissions that aren't regeneratable from nothing).
Their *build output* (`build/`, `Pods/`, `DerivedData/`, `xcuserdata/`, etc.) and signing secrets
(`keystore.properties`, `*.jks`, `exportOptions.plist`) are gitignored — see `.gitignore`.

## 5. Application IDs, names, versioning

| App              | Bundle/Application ID          | Display name                | minSdk / compileSdk / targetSdk |
|-------------------|--------------------------------|------------------------------|----------------------------------|
| customer-app       | `com.patheyaexpress.customer` | Patheya Express              | 24 / 36 / 36 |
| restaurant-app     | `com.patheyaexpress.partner`  | Patheya Express Partner      | 24 / 36 / 36 |
| delivery-app       | `com.patheyaexpress.delivery` | Patheya Express Delivery     | 24 / 36 / 36 |

`versionCode`/`versionName` (Android, `android/app/build.gradle`) and
`CURRENT_PROJECT_VERSION`/`MARKETING_VERSION` (iOS, `App.xcodeproj`) start at `1`/`1.0` in all
three — bump these per release using your normal release process.

## 6. Signing placeholders

- **Android**: `android/app/build.gradle` reads `android/keystore.properties` (gitignored) if
  present and signs `release` builds with it; falls back to the Android debug keystore otherwise,
  so `assembleRelease` still works locally without a real keystore. Copy
  `android/keystore.properties.example` → `android/keystore.properties` and fill in your real
  release keystore path/passwords/alias before shipping.
- **iOS**: `App.xcodeproj` is left on `CODE_SIGN_STYLE = Automatic` with the correct bundle id
  already set — opening the project in Xcode with a signed-in Apple ID lets you pick a Team
  directly. For CI/`xcodebuild -exportArchive`, copy `ios/exportOptions.plist.example` →
  `ios/exportOptions.plist` and fill in your real Apple Developer Team ID.

## 7. Build commands

```bash
# Web build — unchanged, still works exactly as before
nx build customer-app --configuration=production
nx build restaurant-app --configuration=production
nx build delivery-app --configuration=production
nx build admin-app --configuration=production

# Mobile build (native-reachable API origin) + copy into android/ + ios/
nx run customer-app:cap-sync --configuration=mobile
nx run restaurant-app:cap-sync --configuration=mobile
nx run delivery-app:cap-sync --configuration=mobile

# Or, from the workspace root:
pnpm run mobile:build      # nx build all 3, --configuration=mobile
pnpm run mobile:sync       # nx build + cap sync, all 3
pnpm run mobile:sync:customer
pnpm run mobile:sync:partner
pnpm run mobile:sync:delivery
```

`cap-sync` always builds first (`dependsOn: [{ target: "build", params: "forward" }]` in each
app's `project.json`), so it forwards whatever `--configuration` you pass — use `mobile` for a
device-reachable origin, or `production`/`qa`/`staging` to package one of those origins instead.

### Live reload

Set `CAP_SERVER_URL` to your machine's LAN IP before syncing, and `capacitor.config.ts` will point
the native shell at the Nx dev server instead of the bundled `webDir`:

```bash
# Terminal 1 — dev server reachable on the LAN
nx serve customer-app --configuration=development --host 0.0.0.0

# Terminal 2 — point the native shell at it (cap reads capacitor.config.ts from cwd) and open the IDE
cd apps/customer-app
CAP_SERVER_URL=http://192.168.1.20:4200 npx cap sync
cd ../..
pnpm run mobile:android:customer   # or mobile:ios:customer
```

Unset `CAP_SERVER_URL` (or just don't set it) for every packaged/production build — the config
falls back to `{ androidScheme: 'https' }` and loads the bundled `webDir`.

## 8. Android run command

```bash
pnpm run mobile:android:customer   # opens apps/customer-app/android in Android Studio
pnpm run mobile:android:partner    # apps/restaurant-app/android
pnpm run mobile:android:delivery   # apps/delivery-app/android
```

equivalent to `cd apps/customer-app && npx cap open android`. From Android Studio: select a
device/emulator and hit Run. Requires Android Studio + an SDK/emulator installed locally — neither
was available in this environment, so `cap add android` was verified (scaffolding, Gradle sync,
plugin registration) but an actual `gradlew assembleDebug`/emulator run was not.

## 9. iOS run command

```bash
pnpm run mobile:ios:customer       # opens apps/customer-app/ios/App/App.xcodeproj in Xcode
pnpm run mobile:ios:partner
pnpm run mobile:ios:delivery
```

equivalent to `cd apps/customer-app && npx cap open ios`. **Requires macOS** — Xcode and
CocoaPods don't run on Windows. From this Windows environment, `cap add ios` was verified
(project scaffolding, `Package.swift` plugin registration); `pod install` and an actual
simulator/device run must happen on a Mac. On first checkout on macOS, run `npx cap sync ios`
from inside `apps/<app>/` (or `pod install` inside `ios/App/`) before opening the workspace.

## 10. Remaining risks / follow-ups

- **Not validated on real Android/iOS toolchains.** This machine has no Android Studio/SDK/
  emulator and no Xcode (Windows) — `cap add`/`cap sync` were verified end-to-end (they ran
  cleanly, produced valid-looking project files, registered all four plugins on both platforms),
  but no `gradlew assembleDebug`, emulator boot, `pod install`, or Xcode build was actually run.
  Do that on real toolchains before shipping.
- **No app icons / splash images** were generated — Capacitor's templates ship placeholder
  Android/iOS icons and a blank splash. Run `@capacitor/assets` (or equivalent) against real
  brand assets per app before a store submission; out of scope for "no UI" Phase 1.
  Explicitly deferred per the brief.
- **Push notifications, deep links, native permissions (camera/location for delivery-app's live
  tracking, etc.)** are not configured — no `@capacitor/push-notifications`,
  `@capacitor/geolocation`, or platform manifest/entitlement changes were made. Those are
  feature-shaped work for a later phase, not foundation.
- **Real device testing of the hardware back-button handler** (`mobile.providers.ts`) hasn't
  happened — it's implemented against the documented `@capacitor/app` API but only exercised via
  a successful TypeScript compile, not a running Android device.
- **`environment.mobile.ts` hardcodes the QA origin.** That's intentional (a device/emulator can't
  reach `localhost`), but it means the default mobile build is QA, not production — package with
  `--configuration=production` explicitly for a store release, not `--configuration=mobile`.
- **Signing is placeholder-only**, as scoped — no real keystore or Apple Team ID exists yet; see
  §6. Store submission will fail until those are filled in with real, securely-stored credentials.
