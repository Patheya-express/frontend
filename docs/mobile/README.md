# Patheya Express Mobile Development & Launch Prerequisites

The authoritative guide for building, syncing, installing, launching and releasing the Patheya
Express mobile apps (Customer, Restaurant/Partner, Delivery) on iOS and Android.

- **Architecture/design history** of the Capacitor shells (`MobilePlatformService`,
  `provideMobilePlatform()`, safe-area tokens): [`CAPACITOR.md`](./CAPACITOR.md). Not repeated here.
- **Launcher** (`pnpm customer:ios`, `pnpm partner:android`, …):
  [`tools/launcher/README.md`](../../tools/launcher/README.md).

Every command below exists in this repository's `package.json`, Nx project configuration or native
projects. Run commands from the `frontend/` repository root unless a step says otherwise.

**Status vocabulary used throughout**

| Status                              | Meaning                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **IMPLEMENTED**                     | Done in this repository.                                                                                   |
| **VALIDATED**                       | Implemented and verified by an actual build/run, with the evidence stated.                                 |
| **REQUIRES EXTERNAL CONFIGURATION** | The repository has a defined slot for the value or file; someone with the external account must supply it. |
| **BLOCKED**                         | Can't proceed without an external account or credential that doesn't exist yet.                            |

> **Overall: repository production-ready pending external prerequisites.** Every repository-side
> stage is implemented. Store release is blocked only by the external items in
> [§25](#25-external-actions-register), and the release gate (`pnpm verify:mobile-release`) lists
> them mechanically.

---

## Contents

0. [Validation Matrix](#0-validation-matrix)
1. [Overview](#1-overview)
2. [Supported Development Environment](#2-supported-development-environment)
3. [Required Developer Tools](#3-required-developer-tools)
4. [Repository Setup](#4-repository-setup)
5. [Environments & Configuration](#5-environments--configuration)
6. [Build](#6-build)
7. [Capacitor Sync & Swift Package Manager](#7-capacitor-sync--swift-package-manager)
8. [iOS Development & Physical Devices](#8-ios-development--physical-devices)
9. [iOS Signing — Development, TestFlight, App Store](#9-ios-signing--development-testflight-app-store)
10. [iOS UIScene Lifecycle](#10-ios-uiscene-lifecycle)
11. [Sentry (Crash Reporting)](#11-sentry-crash-reporting)
12. [Android Development & Physical Devices](#12-android-development--physical-devices)
13. [Android Signing](#13-android-signing)
14. [Permissions & Location](#14-permissions--location)
15. [Payments (Razorpay)](#15-payments-razorpay)
16. [Google Maps](#16-google-maps)
17. [Push Notifications](#17-push-notifications)
18. [Deep Links](#18-deep-links)
19. [App Identity, Versioning, Icons & Splash](#19-app-identity-versioning-icons--splash)
20. [CI/CD](#20-cicd)
21. [TestFlight & App Store Release](#21-testflight--app-store-release)
22. [Google Play Release](#22-google-play-release)
23. [Troubleshooting](#23-troubleshooting)
24. [Production Checklist](#24-production-checklist)
25. [External Actions Register](#25-external-actions-register)

---

## 0. Validation Matrix

Evidence key: _gen_ = `xcodebuild … -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO`
(Debug and Release); _gradle_ = `./gradlew assembleDebug` / `bundleRelease` on JDK 21 + Android SDK 36.

### iOS

|                                                                                           | Customer                                                  | Restaurant                                                                               | Delivery                                                                                 |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Build (Debug + Release, generic device)                                                   | PASS (_gen_, 0 errors)                                    | PASS (_gen_, 0 errors)                                                                   | PASS (_gen_, 0 errors)                                                                   |
| Sync (`pnpm mobile:sync:*`) + SPM resolve (capacitor-swift-pm 8.5.2, sentry-cocoa 9.28.0) | PASS                                                      | PASS                                                                                     | PASS                                                                                     |
| UIScene migration                                                                         | PASS                                                      | PASS                                                                                     | PASS                                                                                     |
| Simulator                                                                                 | PASS (iOS 27 simulator launch, earlier release cycle)     | PENDING                                                                                  | PENDING                                                                                  |
| Physical device                                                                           | PASS (iPhone 16 Pro Max, development-signed launch)       | PASS (iPhone 16 Pro Max, development-signed Debug; launched and still running after 8 s) | PASS (iPhone 16 Pro Max, development-signed Debug; launched and still running after 8 s) |
| Release build (Archive)                                                                   | BLOCKED — needs Apple Developer Program team (§9)         | BLOCKED                                                                                  | BLOCKED                                                                                  |
| Signing                                                                                   | Development: PASS (Personal Team) · Distribution: BLOCKED | Development: PASS · Distribution: BLOCKED                                                | Development: PASS · Distribution: BLOCKED                                                |
| Production config (`pnpm verify:mobile-release`)                                          | BLOCKED — live Razorpay key, Sentry DSN, Maps key         | BLOCKED — Sentry DSN, Maps key                                                           | BLOCKED — Sentry DSN, Maps key                                                           |

### Android

|                                                  | Customer                                                                                                                                    | Restaurant                                             | Delivery                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Build (`assembleDebug`)                          | PASS (_gradle_)                                                                                                                             | PASS (_gradle_)                                        | PASS (_gradle_)                                        |
| Sync                                             | PASS                                                                                                                                        | PASS                                                   | PASS                                                   |
| Emulator                                         | PENDING (no emulator image installed)                                                                                                       | PENDING                                                | PENDING                                                |
| Physical device                                  | PASS — reported by the project owner before this change set; re-test pending for the new location permission                                | PENDING                                                | PENDING                                                |
| Release build (`bundleRelease`)                  | PASS — R8-minified AAB, signed with a throwaway validation key via `PATHEYA_ANDROID_*`; without credentials the build **fails** as designed | PASS (same)                                            | PASS (same)                                            |
| Signing                                          | Debug: PASS · Release keystore: BLOCKED (no real keystore yet)                                                                              | Debug: PASS · Release: BLOCKED                         | Debug: PASS · Release: BLOCKED                         |
| Production config (`pnpm verify:mobile-release`) | BLOCKED — live Razorpay key, Sentry DSN, Maps key                                                                                           | BLOCKED — Sentry DSN, Maps key, `google-services.json` | BLOCKED — Sentry DSN, Maps key, `google-services.json` |

Merged Android permissions were checked in the built APKs with `aapt2 dump permissions` (§14).

---

## 1. Overview

The mobile apps are the **existing Angular applications packaged in Capacitor native shells**. The
same Angular build that runs on the web is bundled into each native project and loaded in a WebView.
Capacitor plugins add native capabilities: status bar, splash screen, keyboard, geolocation, haptics,
push notifications, secure storage, deep links and Sentry.

| Nx project       | Role                                    | Bundle / Application ID       | Display name             | Native projects                       |
| ---------------- | --------------------------------------- | ----------------------------- | ------------------------ | ------------------------------------- |
| `customer-app`   | Customer                                | `com.patheyaexpress.customer` | Patheya Express          | `apps/customer-app/android`, `/ios`   |
| `restaurant-app` | Restaurant partner (scripts: `partner`) | `com.patheyaexpress.partner`  | Patheya Express Partner  | `apps/restaurant-app/android`, `/ios` |
| `delivery-app`   | Delivery partner                        | `com.patheyaexpress.delivery` | Patheya Express Delivery | `apps/delivery-app/android`, `/ios`   |
| `admin-app`      | Admin                                   | —                             | —                        | **Web only — no mobile target**       |

```
Angular source (apps/<app>/src)
  │  pnpm mobile:build          → nx build <app> --configuration=mobile
  ▼
dist/apps/<app>/browser          (webDir in apps/<app>/capacitor.config.ts)
  │  pnpm mobile:sync:<app>     → build + `npx cap sync` inside apps/<app>/
  ▼
ios/App/App/public, android/app/src/main/assets/public   (gitignored web assets)
ios/App/CapApp-SPM/Package.swift, android/capacitor.settings.gradle   (regenerated, committed)
  │  pnpm mobile:ios:<app> / pnpm mobile:android:<app>   → Xcode / Android Studio
  ▼
Build, sign, run
```

**Use the Nx workflow, never root-level Capacitor commands.** Each app is its own Capacitor project
in `apps/<app>/`, and the Nx targets (`cap-sync`, `cap-open-ios`, `cap-open-android`) run from that
directory and always build first. There is no Capacitor project at the repository root: never run
`npx cap init`, `npx cap add`, `npx cap sync` or `pnpm exec cap …` from the root.

---

## 2. Supported Development Environment

| Tool                            | Requirement                                                                                                                                                          | Source                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Node.js                         | **24** (CI). No `.nvmrc`/`engines` pin. Node 26 builds, but Jest config loading fails on it.                                                                         | `.github/workflows/ci.yml`                          |
| pnpm                            | **11.5.3** — pinned                                                                                                                                                  | `package.json` `packageManager`                     |
| Nx / Angular                    | 23.0.2 / 21.2.x (installed by pnpm)                                                                                                                                  | `package.json`                                      |
| Capacitor core/cli/ios/android  | **8.5.2** (all four must match)                                                                                                                                      | `package.json`, `pnpm-lock.yaml`                    |
| Capacitor plugins               | app 8.1.1, geolocation 8.2.1, haptics 8.0.2, keyboard 8.0.5, push-notifications 8.1.2, splash-screen 8.0.2, status-bar 8.0.3; capacitor-secure-storage-plugin 0.13.0 | `pnpm-lock.yaml`                                    |
| Sentry                          | `@sentry/capacitor` **4.4.0** → `sentry-cocoa` **9.28.0** (exact); `@sentry/angular` 10.69.0                                                                         | §11                                                 |
| **iOS** — macOS + Xcode         | **Xcode 16+** (the SentryCapacitor package uses `swift-tools-version: 6.0`). Validated on **Xcode 27.0 / iOS SDK 27.0**, macOS 26.6.                                 | —                                                   |
| iOS deployment target           | **15.0** — pinned                                                                                                                                                    | `project.pbxproj`, `CapApp-SPM/Package.swift`       |
| iOS dependency manager          | **Swift Package Manager.** **CocoaPods is NOT required for this project** (no `Podfile`).                                                                            | —                                                   |
| **Android** — JDK               | **21** — pinned                                                                                                                                                      | `android/app/capacitor.build.gradle`                |
| Gradle / AGP                    | **8.14.3** (wrapper) / **8.13.0**                                                                                                                                    | `gradle-wrapper.properties`, `android/build.gradle` |
| compileSdk / targetSdk / minSdk | **36 / 36 / 24**                                                                                                                                                     | `android/variables.gradle`                          |
| Google Services plugin          | 4.4.4                                                                                                                                                                | `android/build.gradle`                              |
| Android Studio                  | Current stable that supports AGP 8.13 and SDK 36 (not pinned). Validated with command-line tools: platform-tools, `platforms;android-36`, `build-tools;36.0.0`.      | —                                                   |

---

## 3. Required Developer Tools

**Both platforms:** Git, Node.js 24, pnpm 11.5.3 (`corepack enable && corepack prepare pnpm@11.5.3 --activate`).

**iOS:** a Mac, Xcode (open it once to install components), command-line tools pointed at Xcode
(`sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`, or prefix commands with
`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`), an Apple ID (a free Personal Team is
enough for your own device; the paid **Apple Developer Program** is required for push, TestFlight
and the App Store — §9), and an iPhone running iOS 15+. **Not required: CocoaPods.**

**Android:** Android Studio (or the SDK command-line tools) with **JDK 21**, **SDK Platform 36**,
**Platform-Tools** (`adb`), **Build-Tools 36**, and optionally the Emulator plus a system image.
Set the SDK location:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"          # Android Studio's default on macOS
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

**Check the machine:**

```bash
node -v && pnpm -v && java -version && xcodebuild -version && adb version
pnpm run doctor        # tools + per-app config + backend health
```

Use **`pnpm run doctor`**. pnpm 11 has a built-in `pnpm doctor` command that always takes precedence
over a script with the same name, so plain `pnpm doctor` never reaches the repository's checker.
The checker only asks for CocoaPods if an app's `ios/App` contains a `Podfile`, and none does.

---

## 4. Repository Setup

```bash
git clone <patheya-express-frontend repository URL>
cd frontend
pnpm install --frozen-lockfile
pnpm list @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @sentry/capacitor
```

Use pnpm only. The lockfile is `pnpm-lock.yaml`, and the generated native files (`Package.swift`,
`capacitor.settings.gradle`) reference plugins through pnpm's `node_modules/.pnpm/…` layout. npm or
yarn would produce a layout the native projects can't resolve. `--frozen-lockfile` is what CI runs.

---

## 5. Environments & Configuration

Angular `fileReplacements` (`apps/<app>/project.json`) choose one environment file per build
configuration. Every file is committed and contains **public client-side values only**.

| Configuration                          | File                     | API origin (customer / restaurant / delivery)         | Razorpay key (customer)                                 | Purpose                                                |
| -------------------------------------- | ------------------------ | ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `development` (default for `nx serve`) | `environment.ts`         | `http://localhost:3000`                               | test                                                    | Local web dev                                          |
| `qa`                                   | `environment.qa.ts`      | `https://patheya-express-api-gateway-sg.onrender.com` | test                                                    | QA web                                                 |
| **`mobile`**                           | `environment.mobile.ts`  | same QA origin, `environmentName: 'qa'`               | test                                                    | **Device/emulator builds** (`pnpm mobile:*`, launcher) |
| `staging`                              | `environment.staging.ts` | `https://api.staging.patheyaexpress.com`              | test                                                    | Staging                                                |
| `production`                           | `environment.prod.ts`    | `https://api.patheyaexpress.com`                      | live, injected at build time (see Payments)             | Production web (S3 + CloudFront)                       |
| `mobile-production`                    | `environment.mobile.prod.ts` | `https://api.patheyaexpress.com`                  | live, injected at build time (see Payments)             | Store builds (`pnpm mobile:*:production`)              |

The staging and production origins are the hosts of the backend's own ingress overlays
(`patheya-express-platform/k8s/overlays/{staging,production}/ingress-patch.yaml`). **Neither resolves
in DNS yet.** Production and staging builds won't reach a backend until that deployment exists
(§25). QA and `mobile` stay on the working Render deployment. Production never uses the QA origin.

> **Web deployments share these files.** `production` is each app's default build configuration. Any
> web deployment that builds the default configuration but is meant to run against the QA backend
> (for example a QA demo site) must build with `--configuration=qa`. Otherwise its next
> deploy will point at the production origin.

### Configuration gates

| Command                                           | When                         | Checks                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:prod-env` (also in CI's `build` job) | Every push                   | `environment.prod.ts` has no `REPLACE_WITH`/`CHANGEME`/`TODO` placeholders, no `localhost`, no Razorpay test key                                                                                                                                                                                   |
| **`pnpm verify:mobile-release`**                  | **Before every store build** | The above, plus: production origins are `https://` and differ from the app's QA/mobile origins; `sentryDsn` and `maps.googleMapsApiKey` are set; `releaseVersion` equals Android `versionName` and iOS `MARKETING_VERSION`; `android/app/google-services.json` exists with this app's package name |

Both run `scripts/verify-production-env.mjs` (`<app> [--mobile-release]`). **Expected today:**
`verify:prod-env` fails for `customer-app` on purpose (Razorpay placeholder, §15).
`verify:mobile-release` fails for all three apps, and its output is exactly the external work left.

### Never commit

Android keystores and `keystore.properties`, Apple certificates (`*.p12`, `*.cer`), keys (`*.p8`),
provisioning profiles (`*.mobileprovision`), `exportOptions.plist`, and `.env`/`.env.local`.
`.gitignore` covers all of these repo-wide. Backend secrets (Razorpay key secret, APNs key, FCM
credentials) belong to backend secret management
([`infrastructure/docs/secrets-guide.md`](../../infrastructure/docs/secrets-guide.md)).

**Live reload** (optional): `CAP_SERVER_URL=http://<LAN-IP>:4200` before syncing points the shell at
a dev server ([`CAPACITOR.md` §7](./CAPACITOR.md#live-reload)). Never sync a release build with it
set.

---

## 6. Build

```bash
pnpm mobile:build     # nx run-many --target=build --projects=customer-app,restaurant-app,delivery-app --configuration=mobile
```

Optional on its own: every sync command builds first. Never copy `dist/` into native projects by hand.

---

## 7. Capacitor Sync & Swift Package Manager

```bash
pnpm mobile:sync:customer     # nx run customer-app:cap-sync   --configuration=mobile
pnpm mobile:sync:partner      # nx run restaurant-app:cap-sync --configuration=mobile
pnpm mobile:sync:delivery     # nx run delivery-app:cap-sync   --configuration=mobile
pnpm mobile:sync              # all three

# Store/release bundles: forward another configuration to the same target
pnpm exec nx run customer-app:cap-sync --configuration=production
```

Sync copies the web build into both native projects and regenerates the plugin wiring:

- **iOS:** `ios/App/CapApp-SPM/Package.swift` lists every plugin by path and pins
  `capacitor-swift-pm` to `exact: <@capacitor/ios version>`.
- **Android:** `capacitor.settings.gradle` and `app/capacitor.build.gradle`.

Sync again after pulling, after any dependency or `capacitor.config.ts`/environment change, and to
ship web changes to devices.

`Package.swift`, `capacitor.settings.gradle` and each app's
`App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` are **committed**. They
change only when dependencies change, and are committed together with `package.json` and
`pnpm-lock.yaml`. **Never hand-edit `Package.resolved`.** Xcode or
`xcodebuild -resolvePackageDependencies -project App.xcodeproj` regenerates it. Sync output from
Windows (backslash paths) must not be committed.

---

## 8. iOS Development & Physical Devices

1. Install and open Xcode. Point the command-line tools at it (§3).
2. `pnpm install --frozen-lockfile && pnpm mobile:sync:customer` (or `:partner` / `:delivery`).
3. Resolve packages (Xcode also does this on open):
   ```bash
   cd apps/customer-app/ios/App && xcodebuild -resolvePackageDependencies -project App.xcodeproj; cd -
   ```
   Expect `capacitor-swift-pm @ 8.5.2` and `Sentry … sentry-cocoa @ 9.28.0`.
4. Open the project: `pnpm mobile:ios:customer` / `pnpm mobile:ios:partner` / `pnpm mobile:ios:delivery`.
5. Xcode → Settings → Accounts → add your Apple ID.
6. Target **App** → **Signing & Capabilities** → **Team**: choose your team. Keep **Automatically
   manage signing** on, and don't change the bundle identifier. The team you pick is saved in
   `project.pbxproj` as `DEVELOPMENT_TEAM`. **That change is personal; don't commit it.** No team is
   committed.
7. Connect the iPhone and unlock it. Tap **Trust** on "Trust This Computer?".
8. **Developer Mode:** iPhone **Settings → Privacy & Security → Developer Mode → On**. The phone
   restarts; confirm **Turn On** afterwards. The row only appears after the phone has been connected
   to Xcode once. Without it, Xcode shows the device as unavailable, and development apps can't
   launch.
9. Select **`<Your iPhone>`** as the run destination and press **⌘R**. **Keep the phone unlocked:** iOS
   refuses to launch apps on a locked device.
10. First run with a new account: if iOS says "Untrusted Developer", go to **Settings → General → VPN
    & Device Management → (your Apple ID) → Trust**.

Terminal checks: `xcrun devicectl list devices`; the launcher alternative is `pnpm customer:ios`
(validates, builds, syncs, then launches on a chosen device). The launcher no longer requires
CocoaPods.

---

## 9. iOS Signing — Development, TestFlight, App Store

|                     | Development (your device)                    | TestFlight / App Store                                       |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Account             | Any Apple ID; free Personal Team works       | **Paid Apple Developer Program, organization team**          |
| Build configuration | Debug (⌘R)                                   | Release (Product → Archive)                                  |
| Entitlements        | None (Debug has no `CODE_SIGN_ENTITLEMENTS`) | `App/App.entitlements` → `aps-environment` (push)            |
| Signing             | Automatic, Apple Development certificate     | Automatic, Apple Distribution certificate, App Store profile |
| Status              | **VALIDATED** (all three apps)               | **BLOCKED** — no organization team yet                       |

**IMPLEMENTED: the release-signing guard.** Each app's **Release** configuration signs with
`App/App.entitlements` (`aps-environment`), which only a paid team with the Push Notifications
capability can sign. An archive therefore can't be produced with a free Personal Team. Debug has no
entitlements, so free-team device development keeps working. When exporting for distribution, Xcode
re-signs `aps-environment` as `production` from the distribution profile, so the committed value
`development` is correct.

**Personal Team limits:** profiles expire after 7 days, only a few devices and apps are allowed, and
there's no push capability, TestFlight or App Store. A bundle ID belongs to one team; if the
organization team registers `com.patheyaexpress.*`, personal teams can't use those IDs and developers
must join the organization team.

For command-line exports, copy `apps/<app>/ios/exportOptions.plist.example` to
`exportOptions.plist` (gitignored) and set the organization Team ID. Release steps: §21.

---

## 10. iOS UIScene Lifecycle

**Symptom:** `Application failed to launch: UIScene life cycle is required for apps built with this SDK.`

**Cause:** current iOS SDKs require the scene-based lifecycle. Capacitor iOS 8.4.x had no scene
support; Capacitor **8.5.0** added it (`SceneDelegateProxy`, scene-aware pause/resume).

**Resolution (IMPLEMENTED in all three apps; VALIDATED: builds plus physical launches — §0):**
Capacitor core/cli/ios/android **8.5.2**, plus Capacitor CLI 8.5.2's official migration task
(`migrateToUIScene`) run per app. All three apps now have byte-identical `AppDelegate.swift` and
`SceneDelegate.swift`, and the same `Info.plist` scene manifest:

| File (`apps/<app>/ios/App/…`)   | Content                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App/Info.plist`                | `UIApplicationSceneManifest`: one window scene, `UISceneDelegateClassName = $(PRODUCT_MODULE_NAME).SceneDelegate`, `UISceneStoryboardFile = Main`, multiple scenes off |
| `App/SceneDelegate.swift`       | Capacitor template: window with `CAPBridgeViewController`, forwards connect/URL/universal-link events to `SceneDelegateProxy.shared`                                   |
| `App/AppDelegate.swift`         | `application(_:configurationForConnecting:options:)` → `SceneDelegate`                                                                                                 |
| `App.xcodeproj/project.pbxproj` | `SceneDelegate.swift` in the App target's Sources                                                                                                                      |

Don't run `npx cap migrate` in this repo: it would also upgrade every official plugin and rewrite the
Android Gradle files, and it says itself that it isn't meant for monorepos.

---

## 11. Sentry (Crash Reporting)

**Native SDK (VALIDATED):** `@sentry/capacitor` **4.4.0** pins `sentry-cocoa` **`exact: "9.28.0"`**.
Version 4.3.0 allowed any 9.x, and `sentry-cocoa` 9.29.0 removed `PrivateSentrySDKOnly`, which the
plugin calls (`Cannot find 'PrivateSentrySDKOnly' in scope`). Upgrade Sentry only by upgrading
`@sentry/capacitor` together with `@sentry/angular` at the exact matching version. Never edit
`Package.resolved`; never use CocoaPods.

**Initialization (IMPLEMENTED):** each app's `main.ts` calls `initMobileObservability()`
(`libs/shared/mobile-observability`) before bootstrap: `sendDefaultPii: false`, no tracing,
event/breadcrumb scrubbing, failures swallowed. **An empty `sentryDsn` disables Sentry entirely.**

**DSN (REQUIRES EXTERNAL CONFIGURATION):** no Sentry project exists yet, so `sentryDsn` is empty in
every environment. Repository policy (`AppEnvironment.sentryDsn`) treats a DSN as public, so it's
committed in the environment file. Create one Sentry project per app, put each DSN in
`environment.prod.ts` (and optionally `qa`/`staging`/`mobile`), then run
`pnpm verify:mobile-release`.

---

## 12. Android Development & Physical Devices

Setup: Android Studio or the command-line tools. Gradle JDK = **21** (Android Studio → Settings →
Build Tools → Gradle → Gradle JDK). SDK Platform 36, Build-Tools 36, Platform-Tools. Set
`ANDROID_HOME` (§3).

```bash
pnpm install --frozen-lockfile
pnpm mobile:sync:customer && pnpm mobile:android:customer      # opens Android Studio
pnpm mobile:sync:partner  && pnpm mobile:android:partner
pnpm mobile:sync:delivery && pnpm mobile:android:delivery

# Command line (from apps/<app>/android; gradlew is committed executable)
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug         # install on the connected device/emulator
```

Launcher alternative: `pnpm customer:android` (also `partner:` / `delivery:`).

**Physical device:**

1. Settings → About phone → tap **Build number** 7×.
2. Developer options → **USB debugging**.
3. Connect and accept **Allow USB debugging?**.
4. Check with `adb devices`: the phone should show as `device`. `unauthorized` means accept the
   prompt on the phone. Android 7.0 (API 24) or later.

Release builds need signing (§13).

---

## 13. Android Signing

**IMPLEMENTED and VALIDATED.** `tools/mobile/android/release-signing.gradle`, applied by all three
`app/build.gradle` files, sets the policy:

| Build                                                          | Signing                                                                                                                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debug (`assembleDebug`, Run)                                   | Android debug keystore. Nothing to configure.                                                                                                                                                                   |
| Release (`assembleRelease`, `bundleRelease`, `installRelease`) | **Requires** release credentials. **No debug-key fallback.** Without them `verifyReleaseSigning` fails the build before compiling: `Release signing is not configured for com.patheyaexpress.<app>. Missing: …` |

Credentials, per field, in this order:

1. **`apps/<app>/android/keystore.properties`** (gitignored; copy `keystore.properties.example`):
   `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. A relative `storeFile` resolves
   against `android/app/`.
2. **Environment variables (CI):** `PATHEYA_ANDROID_KEYSTORE_FILE`,
   `PATHEYA_ANDROID_KEYSTORE_PASSWORD`, `PATHEYA_ANDROID_KEY_ALIAS`, `PATHEYA_ANDROID_KEY_PASSWORD`.

Validation evidence: for each app, `bundleRelease` without credentials failed with the message above.
With a throwaway key supplied through the environment variables, it produced an R8-minified AAB that
passed `jarsigner -verify`. That key was created outside the repository, used only for this check,
and never committed.

**Creating the real upload keys (REQUIRES EXTERNAL CONFIGURATION, once per app):**

```bash
keytool -genkeypair -v -storetype PKCS12 -keyalg RSA -keysize 4096 -validity 10000 \
  -keystore patheya-express-customer-release.jks -alias patheya-express-customer
```

Store the `.jks` file and its passwords in the team's secret manager. Never commit them (`*.jks`
and `*.keystore` are gitignored repo-wide). Enroll each app in **Play App Signing** (§22) so this
key acts as the upload key, which Google can reset if it's lost. Use one key per app.

---

## 14. Permissions & Location

Only permissions the code actually needs are requested. These are the merged Android permissions,
read from the built APKs:

| App        | iOS usage strings                             | Android permissions (beyond INTERNET / push / VIBRATE / network state from plugins)                         | Why                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer   | Location (when in use), Camera, Photo Library | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`                                                            | "Nearby restaurants" / current-location use the WebView's `navigator.geolocation`. Capacitor only grants WebView geolocation when these are declared, and accepts coarse-only only on Android 12+, so FINE is needed for API 24–30. Profile, review and support uploads use a file input. |
| Restaurant | Camera, Photo Library                         | —                                                                                                           | Logo/banner, menu photos, gallery and certificate uploads (file input; iOS offers "Take Photo"). No location use.                                                                                                                                                                         |
| Delivery   | Location (when in use), Camera, Photo Library | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `CAMERA` (+ `android.hardware.camera` `required="false"`) | Live courier tracking via `@capacitor/geolocation` while delivering (foreground only). Mandatory pickup-parcel photo and onboarding selfie use `<input capture>`. Capacitor opens the camera directly only when `CAMERA` is declared.                                                     |

No app requests background location or background camera. On iOS, opening the camera without
`NSCameraUsageDescription` terminates the app; Restaurant and Delivery lacked it before this release
and now have it. Store declarations (§21, §22) must match this table.

---

## 15. Payments (Razorpay)

- **Provider:** Razorpay Checkout, **Customer app only** (`libs/shared/core/src/lib/payments/`). The
  other apps carry an empty `razorpayKeyId` and never use it.
- **What's in the frontend:** only the **key ID** (`rzp_test_…` / `rzp_live_…`), which is public by
  design. The **key secret** and order creation/verification belong to the backend and are never
  in this repository.
- **Environment separation (IMPLEMENTED):** development, qa, staging and mobile use the Razorpay
  test key. **The committed production files (`environment.prod.ts`, `environment.mobile.prod.ts`)
  hold the placeholder `REPLACE_WITH_RAZORPAY_LIVE_KEY_ID`**; `scripts/inject-production-env.mjs`
  substitutes the live key ID from the `RAZORPAY_LIVE_KEY_ID` build secret at build time (CI's
  `frontend-deploy-web.yml`, or a release machine for store builds). The live key ID is never
  committed. A test key in production made checkout run in test mode.
- **Enforcement (VALIDATED):** `scripts/verify-production-env.mjs` (CI `build` job,
  `pnpm verify:prod-env`) rejects placeholders and `rzp_test_` keys in both production files, so a
  build that skipped injection fails. CI's `build` job does not inject, so its `customer-app`
  production-config check stays red by design; deployable builds go through `frontend-deploy-web.yml`.
- **External action:** activate the Razorpay live account and generate the live API keys. Store the
  **live key ID** as the `RAZORPAY_LIVE_KEY_ID` secret of the frontend repository's `production`
  GitHub Environment, and give the live **key secret** to the production backend only. Then test a
  live payment end to end.

---

## 16. Google Maps

- **Usage:** Customer address form, Delivery onboarding/profile and the shared
  `libs/shared/map-picker` load the **Google Maps JavaScript API inside the WebView**
  (`@googlemaps/js-api-loader`, libraries `maps`, `geocoding`, `places`, `marker`). No native Maps
  SDK is used, so there's no Android `com.google.android.geo.API_KEY` and no iOS Maps SDK.
- **Behaviour without a key:** the Google provider reports itself unavailable and the map picker
  doesn't load. That's acceptable for development, but **not for a store release**, which is why
  `pnpm verify:mobile-release` requires the key.
- **Configuration:** `maps.googleMapsApiKey` in each environment file. Development files contain a
  browser key; `qa`, `mobile`, `staging` and `production` are empty.
- **External action (Google Cloud):** create a production browser key. Enable **Maps JavaScript
  API, Places API and Geocoding API** only (API restriction). Set an application restriction of
  **Websites** listing the web origins plus the WebView origins `https://localhost` (Android) and
  `capacitor://localhost` (iOS), and **verify on devices**, since WebView referrer handling differs
  by platform. Set billing alerts and quotas. Restrict the committed development key the same way.

---

## 17. Push Notifications

**Frontend (IMPLEMENTED in all three apps):** `PushNotificationsService`
(`libs/shared/core/src/lib/mobile/`) requests permission, registers, and each app sends the token to
`POST /notifications/push-token` after login. Notification taps route through the deep-link
allow-list (§18). Android declares `POST_NOTIFICATIONS`; iOS declares `UIBackgroundModes:
remote-notification`.

**iOS (IMPLEMENTED):** `App/App.entitlements` (`aps-environment`) on the **Release** configuration
of each app (§9). Debug builds don't receive push; that's an accepted trade-off so free-team device
development keeps working. A developer on the paid team can test push in Debug by temporarily
setting `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` for Debug locally, without committing it.

**Android (REQUIRES EXTERNAL CONFIGURATION):** FCM needs each app's
`android/app/google-services.json`. Customer has one (Firebase project `patheyaexpress`, package
`com.patheyaexpress.customer`). **Restaurant and Delivery have none.** Gradle builds fine without
it, but push can't work. In the Firebase console, add Android apps `com.patheyaexpress.partner` and
`com.patheyaexpress.delivery`, then download and commit their `google-services.json`. The file
contains public client identifiers, not secrets. The release gate checks for it.

**Backend (BLOCKED — outside this repository):** the backend stores tokens (`push_tokens`) but has
**no sending implementation** (no FCM or APNs client). On iOS, `@capacitor/push-notifications`
returns a raw **APNs device token**, not an FCM token. The backend must either send through APNs
(an APNs auth key `.p8` from the Apple Developer account), or the apps must adopt the Firebase
Messaging iOS SDK so iOS tokens become FCM tokens. That's an architecture decision for the backend
team; nothing in this repository needs to change until it's made.

---

## 18. Deep Links

| App                  | Scheme                                                                                   | Status                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer             | `patheyaexpress://` (iOS `CFBundleURLSchemes`, Android `VIEW`/`BROWSABLE` intent filter) | IMPLEMENTED                                                                                                                                                                                      |
| Restaurant, Delivery | none, **by design**                                                                      | Push-notification taps navigate in-app. Registering the same scheme in several apps would make iOS pick one of them unpredictably. If they ever need OS-level links, give them distinct schemes. |

Every incoming URL goes through `validateDeepLink`
(`libs/shared/mobile-security/src/lib/deep-link/deep-link-validator.ts`, unit-tested) before
reaching the router. It's a strict allow-list:

- routes `restaurants[/<id>[/offers]]`, `notifications[/<id>]`, `orders[/<id>]` and `assignments`;
- IDs `[A-Za-z0-9_-]{1,64}`;
- no query strings, userinfo or ports.

Anything else is ignored. The handler is `App.addListener('appUrlOpen')` in `mobile.providers.ts`.
On iOS, URLs arrive through `SceneDelegate` → `SceneDelegateProxy`, which still posts Capacitor's URL
notification.

The behaviour is identical in development, QA and production: the scheme and routes don't depend on
the environment. Opening a custom-scheme link from Safari shows iOS's "Open in …?" confirmation,
which is standard system behaviour for custom schemes and can't be suppressed. Avoiding it needs
**universal links / Android App Links**, which aren't implemented: they need an
`apple-app-site-association` and `assetlinks.json` hosted on a production domain (external), plus
the Associated Domains entitlement under the paid team.

Test on a device: `xcrun simctl openurl booted "patheyaexpress://restaurants"` (simulator) or
`adb shell am start -a android.intent.action.VIEW -d "patheyaexpress://restaurants"`.

---

## 19. App Identity, Versioning, Icons & Splash

**Identity (VALIDATED):** unique IDs per app (§1), checked in the built APK and `Info.plist`.
Changing an ID after store publication creates a new store listing, so don't.

**Versioning:** each app is versioned independently.

|                                           | Android (`apps/<app>/android/app/build.gradle`) | iOS (`project.pbxproj`, App target)                                           | Web/Sentry                                       |
| ----------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| User-visible                              | `versionName "1.0"`                             | `MARKETING_VERSION = 1.0`                                                     | `releaseVersion: '1.0'` in each environment file |
| Build number (must increase every upload) | `versionCode 1`                                 | `CURRENT_PROJECT_VERSION = 1` (or `xcodebuild … CURRENT_PROJECT_VERSION=<n>`) | —                                                |

The three user-visible values must match; `pnpm verify:mobile-release` enforces that. Bump the build
number for every upload to a store.

**Icons & splash (BLOCKED — artwork missing):** all three apps still use **Capacitor's stock
placeholder icon and splash** (identical to Capacitor's template; the repository has no brand
artwork beyond web favicons). Placeholder icons aren't acceptable for store submission. Provide per
app:

- a 1024×1024 px square icon with no transparency or rounded corners (iOS);
- an Android adaptive-icon foreground and background (432×432 px, important content within the
  central 264 px);
- a splash logo or full 2732×2732 px splash (light and optionally dark).

Then generate every size from inside the app directory:

```bash
cd apps/customer-app        # assets/icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png
pnpm dlx @capacitor/assets generate --ios --android
```

**Privacy manifest:** the app targets' own code (`AppDelegate`/`SceneDelegate`) uses no
required-reason APIs. Capacitor and Sentry ship their own `PrivacyInfo.xcprivacy`, so no app-level
manifest is required. The App Store privacy "nutrition label" is filled in App Store Connect (§21).

---

## 20. CI/CD

`.github/workflows/ci.yml` (push to `main` and PRs; pnpm 11.5.3, Node 24, `pnpm install --frozen-lockfile`):

| Job                                                    | What it does                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint` / `test`                                        | `nx affected` lint / test                                                                                                                     |
| `build` (matrix: 4 apps)                               | `scripts/verify-production-env.mjs <app>` then `nx build <app> --configuration=production`                                                    |
| **`android`** (matrix: customer, restaurant, delivery) | `nx run <app>:cap-sync --configuration=mobile`, then `./gradlew assembleDebug` on JDK 21 (temurin). Catches native/plugin/Gradle regressions. |

**Not in CI, deliberately:**

- iOS builds: they need macOS runners and Apple signing.
- Store release pipelines: there's no signing material yet, and no repository pattern for one.

When a release pipeline is added, it needs these GitHub **secrets**, scoped to a protected
environment:

| Platform | Secret                                                                                            | Use                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Android  | `PATHEYA_ANDROID_KEYSTORE_BASE64` (one per app)                                                   | Decode to a temp file; set `PATHEYA_ANDROID_KEYSTORE_FILE` to that path                                 |
| Android  | `PATHEYA_ANDROID_KEYSTORE_PASSWORD`, `PATHEYA_ANDROID_KEY_ALIAS`, `PATHEYA_ANDROID_KEY_PASSWORD`  | Read directly by `release-signing.gradle`                                                               |
| Android  | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`                                                                | Upload AABs to Play (internal track first)                                                              |
| iOS      | `APPLE_TEAM_ID`                                                                                   | `DEVELOPMENT_TEAM` for archive/export (never committed)                                                 |
| iOS      | `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_P8` | `xcodebuild -allowProvisioningUpdates -authenticationKey…` for automatic signing, and TestFlight upload |

Sequence:

1. `pnpm verify:mobile-release`
2. `nx run <app>:cap-sync --configuration=production`
3. Android `bundleRelease` / iOS `xcodebuild archive` + `-exportArchive` (`exportOptions.plist`)
4. Upload

---

## 21. TestFlight & App Store Release

**Repository side (IMPLEMENTED):** bundle IDs; UIScene; push entitlement on Release; usage strings
(§14); `exportOptions.plist.example`; production configuration gate; versioning; deployment target
iOS 15.

**External (BLOCKED until the accounts exist), per app:**

1. Join the Apple Developer Program (organization).
2. Register App IDs `com.patheyaexpress.customer`, `.partner` and `.delivery`, with the **Push
   Notifications** capability.
3. Create an APNs auth key (`.p8`) for the backend (§17).
4. Create App Store Connect app records.
5. Set the organization team in Xcode, locally for archiving or via CI's `APPLE_TEAM_ID`.
6. Run `pnpm verify:mobile-release` and fix everything it reports.
7. Run `pnpm exec nx run <app>:cap-sync --configuration=production`.
8. Bump `CURRENT_PROJECT_VERSION`, and `MARKETING_VERSION` plus `releaseVersion` for user-visible
   releases.
9. Xcode: select **Any iOS Device** → **Product → Archive** → **Distribute App → App Store
   Connect**. Test in TestFlight on physical devices.
10. In App Store Connect: privacy nutrition labels (location, photos/camera uploads, contact and
    account data, purchases, crash data via Sentry), privacy policy URL, screenshots, review notes
    (test accounts for partner and delivery logins).

---

## 22. Google Play Release

**Repository side (IMPLEMENTED):**

- application IDs;
- target SDK 36;
- R8 release builds;
- mandatory release signing (§13);
- minimal permissions (§14);
- AAB output (`bundleRelease`).

**Separate Play Console apps:** yes. Customer, Restaurant (Partner) and Delivery are three distinct
packages and need three Play Console entries, each with its own listing, Data safety form and
content rating.

**External (BLOCKED until the account exists), per app:**

1. Create the Google Play Console developer account and the app entries.
2. Create the upload keystore (§13) and enroll in **Play App Signing**.
3. Firebase: add `google-services.json` for Restaurant and Delivery (§17).
4. Run `pnpm verify:mobile-release` and then the production sync.
5. Bump `versionCode` (and `versionName` + `releaseVersion` for user-visible releases).
6. Run `./gradlew bundleRelease` with release credentials and upload to **Internal testing**. Then
   Closed testing, then Production.
7. **Data safety:** approximate and precise location (Customer: app functionality; Delivery: live
   tracking shared with customers while delivering), photos/camera uploads, personal info and
   account data, purchase history (Customer), crash logs (Sentry), push device tokens. Data is
   encrypted in transit (HTTPS).
8. Upload the store listing assets: final icon (§19), feature graphic and screenshots.

---

## 23. Troubleshooting

### iOS

| Problem                                                                                                     | Fix                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| "Signing … requires a development team"                                                                     | Signing & Capabilities → select a Team (§8).                                                                                                 |
| "Personal development teams … do not support the Push Notifications capability" on **Archive/Release**      | Expected: Release requires the paid organization team (§9). Use Debug (⌘R) for device development.                                           |
| "Failed to register bundle identifier" / "No profiles for com.patheyaexpress.…"                             | The ID belongs to another team, or a free team hit its limits. Join the owning team; don't change the ID.                                    |
| "Untrusted Developer"                                                                                       | Settings → General → VPN & Device Management → Trust.                                                                                        |
| "Developer Mode disabled" / device unavailable                                                              | §8 step 8.                                                                                                                                   |
| "Unable to launch … because the device was not, or could not be, unlocked"                                  | Unlock the iPhone and keep it unlocked while launching.                                                                                      |
| iPhone not listed                                                                                           | Unlock, reconnect, accept Trust, check Window → Devices and Simulators, `xcrun devicectl list devices`.                                      |
| "UIScene life cycle is required for apps built with this SDK"                                               | The app is missing the §10 files; restore them from Git.                                                                                     |
| Swift packages fail to resolve                                                                              | `pnpm install --frozen-lockfile && pnpm mobile:sync:<app>`, then File → Packages → Resolve Package Versions.                                 |
| "…xcframework.zip already exists in file system" / missing `Sentry.xcframework` / "No such module 'Sentry'" | Stale artifacts after a version change: File → Packages → **Reset Package Caches**, then ⇧⌘K.                                                |
| Persistent odd build errors (DerivedData corruption)                                                        | Quit Xcode, delete this project's `App-…` folder under the DerivedData path from Xcode → Settings → Locations, reopen. Troubleshooting only. |
| `Cannot find 'PrivateSentrySDKOnly' in scope`                                                               | `sentry-cocoa` resolved to 9.29+. Check `pnpm list @sentry/capacitor` shows 4.4.0, then resolve again (§11).                                 |
| `pod: command not found`                                                                                    | CocoaPods isn't used. Pull the latest launcher; nothing in the repo calls `pod`.                                                             |
| `xcodebuild` requires Xcode but the active developer directory is Command Line Tools                        | §3.                                                                                                                                          |
| Disk full during builds                                                                                     | Each DerivedData folder is around 4 GB with all Swift package artifacts; delete old ones.                                                    |

### Android

| Problem                                                          | Fix                                                                                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Release signing is not configured for …`                        | Expected without credentials: provide `keystore.properties` or the `PATHEYA_ANDROID_*` variables (§13), or use `assembleDebug`.                 |
| `adb devices` → `unauthorized`                                   | Accept the prompt on the phone. Otherwise: Developer options → Revoke USB debugging authorizations; `adb kill-server && adb start-server`.      |
| Device not detected                                              | Use a data cable and File-transfer mode, check USB debugging, restart adb.                                                                      |
| "SDK location not found"                                         | Install Platform 36 and set `ANDROID_HOME` (or Android Studio writes the gitignored `local.properties`).                                        |
| JDK mismatch / "Unsupported class file major version"            | Set Gradle JDK and `JAVA_HOME` to 21.                                                                                                           |
| Gradle failure after pulling                                     | `pnpm install --frozen-lockfile && pnpm mobile:sync:<app>` (plugin paths point into `node_modules/.pnpm`), then Sync Project with Gradle Files. |
| Capacitor version mismatch warnings                              | core/cli/android/ios must all be 8.5.2; plugins on major 8.                                                                                     |
| Stale artifacts                                                  | `./gradlew clean` (or Build → Clean Project), then re-sync.                                                                                     |
| "google-services.json not found … Push Notifications won't work" | Restaurant/Delivery today: §17.                                                                                                                 |
| Location never prompts (Customer)                                | Requires a build that includes the location permissions (§14). Re-sync and reinstall.                                                           |

---

## 24. Production Checklist

**Environment & dependencies**

- [ ] Node 24, pnpm 11.5.3; `pnpm run doctor` clean
- [ ] `pnpm install --frozen-lockfile` with no lockfile changes; Capacitor core 8.5.2 ×4; `@sentry/capacitor` 4.4.0 / `sentry-cocoa` 9.28.0

**Configuration (all enforced by `pnpm verify:mobile-release`)**

- [ ] Production API deployed at `https://api.patheyaexpress.com` and reachable (HTTPS, WebSocket)
- [ ] Live Razorpay key ID (Customer); key secret on the backend only
- [ ] Sentry DSN per app · restricted Google Maps key
- [ ] `releaseVersion` = `versionName` = `MARKETING_VERSION`; build numbers bumped
- [ ] `CAP_SERVER_URL` not set; production sync used

**iOS**

- [ ] Organization team; App IDs with Push; App Store Connect records
- [ ] Archive (Release) signs with distribution + `aps-environment`
- [ ] TestFlight install and smoke test on physical devices (all three apps)

**Android**

- [ ] Release keystores in the secret manager; Play App Signing enrolled
- [ ] `google-services.json` for all three apps
- [ ] `bundleRelease` signed with the release key; internal-track install and smoke test on physical devices

**Features on device**

- [ ] Payments: live end-to-end payment (Customer)
- [ ] Push: backend sender implemented; notification received on iOS and Android
- [ ] Deep links: `patheyaexpress://restaurants/<id>` opens and routes (Customer)
- [ ] Location: Customer "nearby"; Delivery live tracking; permission texts correct
- [ ] Camera: Delivery pickup photo and selfie; Restaurant uploads
- [ ] Sentry: a test event arrives from each app and platform

**Security & store**

- [ ] No secrets committed (`.gitignore` covers signing material); keys restricted
- [ ] Final icons and splash (§19); listings; privacy declarations (§21, §22)

---

## 25. External Actions Register

Everything below needs an account, credential or deployment outside this repository. Each entry has a
defined place in the repository, so none of it needs code changes.

| #   | Action                                                                                                          | Owner                                | Repository slot                                                          | Blocks                                                    |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| 1   | Deploy the production backend + DNS for `api.patheyaexpress.com` (and staging `api.staging.patheyaexpress.com`) | Backend/infra                        | `environment.prod.ts` / `.staging.ts` (already set)                      | All production/staging builds                             |
| 2   | Razorpay live account → live key ID                                                                             | Business/payments                    | `apps/customer-app/src/environments/environment.prod.ts` `razorpayKeyId` | Customer production build (CI `build` job red until done) |
| 3   | Sentry projects (one per app) → DSNs                                                                            | Engineering                          | `sentryDsn` in each `environment.prod.ts`                                | `verify:mobile-release`                                   |
| 4   | Google Cloud production Maps key (restricted, §16)                                                              | Engineering                          | `maps.googleMapsApiKey` in each `environment.prod.ts`                    | `verify:mobile-release`                                   |
| 5   | Firebase Android apps for `com.patheyaexpress.partner` and `.delivery`                                          | Engineering                          | `apps/<app>/android/app/google-services.json`                            | Android push; `verify:mobile-release`                     |
| 6   | Backend push sender (APNs and/or FCM) + decision on iOS token type                                              | Backend                              | —                                                                        | Push delivery (all apps)                                  |
| 7   | Apple Developer Program organization team, App IDs with Push, APNs key, App Store Connect records               | Business/engineering                 | Team in Xcode / `APPLE_TEAM_ID`; `exportOptions.plist` (gitignored)      | TestFlight, App Store, iOS push                           |
| 8   | Android upload keystores (×3) + Play Console apps + Play App Signing                                            | Business/engineering                 | `keystore.properties` or `PATHEYA_ANDROID_*` secrets                     | Google Play                                               |
| 9   | Final brand icons and splash artwork (×3 apps)                                                                  | Design                               | `apps/<app>/assets/` → `@capacitor/assets`                               | Store submission                                          |
| 10  | QA/demo web deployments build with `--configuration=qa`, not the default `production`                         | Whoever owns the deployment settings | Hosting settings                                                         | Web demo against QA backend                               |
| 11  | Restrict the committed development Google Maps key (all four apps' `environment.ts`)                            | Engineering                          | Google Cloud console                                                     | Key misuse risk                                           |
