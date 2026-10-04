# Patheya Express Mobile Development & Launch Prerequisites

The authoritative guide for building, syncing, installing and launching the Patheya Express mobile
apps on Android and iOS — from a fresh machine through to store-release prerequisites.

- **Architecture/design history** of the mobile shells (why each app has its own Capacitor project,
  `MobilePlatformService`, `provideMobilePlatform()`, safe-area tokens): see
  [`CAPACITOR.md`](./CAPACITOR.md). This document does not repeat it.
- **Launcher** (`pnpm customer:ios`, `pnpm customer:android`, …): see
  [`tools/launcher/README.md`](../../tools/launcher/README.md) and the limitation in
  [§21](#21-known-current-limitations).

Every command below exists in this repository's `package.json` or Nx project configuration. Run all
commands from the `frontend/` repository root unless a step says otherwise.

---

## Contents

1. [Overview](#1-overview)
2. [Supported Development Environment](#2-supported-development-environment)
3. [Required Developer Tools](#3-required-developer-tools)
4. [Repository Setup](#4-repository-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Build the Web Application for Mobile](#6-build-the-web-application-for-mobile)
7. [Capacitor Sync](#7-capacitor-sync)
8. [iOS Setup — First Time](#8-ios-setup--first-time)
9. [iOS Developer Mode](#9-ios-developer-mode)
10. [iOS Signing & Trust](#10-ios-signing--trust)
11. [iOS UIScene Requirement](#11-ios-uiscene-requirement)
12. [iOS Sentry / Swift Package Requirement](#12-ios-sentry--swift-package-requirement)
13. [iOS Troubleshooting](#13-ios-troubleshooting)
14. [Android Setup — First Time](#14-android-setup--first-time)
15. [Android Build Workflow](#15-android-build-workflow)
16. [Android Physical Device](#16-android-physical-device)
17. [Android Signing](#17-android-signing)
18. [Android Troubleshooting](#18-android-troubleshooting)
19. [Production Release Prerequisites](#19-production-release-prerequisites)
20. [Pre-Launch Checklist](#20-pre-launch-checklist)
21. [Known Current Limitations](#21-known-current-limitations)

---

## 1. Overview

Patheya Express's mobile apps are the **existing Angular applications packaged in a Capacitor
native shell**. There is no separate mobile codebase: the same Angular build that runs on the web is
bundled into each native project and loaded in a WebView, and Capacitor plugins provide native
capabilities (status bar, splash screen, keyboard, geolocation, haptics, push notifications, secure
storage, deep links, Sentry crash reporting).

| Nx project       | Mobile name / role             | Bundle / Application ID       | Display name             | Native projects                       |
| ---------------- | ------------------------------ | ----------------------------- | ------------------------ | ------------------------------------- |
| `customer-app`   | Customer                       | `com.patheyaexpress.customer` | Patheya Express          | `apps/customer-app/android`, `/ios`   |
| `restaurant-app` | Restaurant partner ("partner") | `com.patheyaexpress.partner`  | Patheya Express Partner  | `apps/restaurant-app/android`, `/ios` |
| `delivery-app`   | Delivery partner               | `com.patheyaexpress.delivery` | Patheya Express Delivery | `apps/delivery-app/android`, `/ios`   |
| `admin-app`      | Admin                          | —                             | —                        | **Web only — no mobile target**       |

> The restaurant app's npm scripts use the name **`partner`** (`mobile:sync:partner`,
> `mobile:ios:partner`, `partner:ios`), matching its app ID `com.patheyaexpress.partner`.

### How the web build and native projects relate

```
Angular source (apps/<app>/src)
  │  pnpm mobile:build            → nx build <app> --configuration=mobile
  ▼
dist/apps/<app>/browser           (webDir in apps/<app>/capacitor.config.ts)
  │  pnpm mobile:sync:<app>       → nx build + `npx cap sync` inside apps/<app>/
  ▼
apps/<app>/ios/App/App/public                    (iOS web assets, gitignored)
apps/<app>/android/app/src/main/assets/public    (Android web assets, gitignored)
apps/<app>/ios/App/CapApp-SPM/Package.swift      (regenerated: iOS plugin packages)
apps/<app>/android/capacitor.settings.gradle     (regenerated: Android plugin modules)
  │  pnpm mobile:ios:<app> / pnpm mobile:android:<app>   → opens Xcode / Android Studio
  ▼
Build, sign and run from the IDE
```

### Why the existing Nx workflow must be used

- **Each app is its own Capacitor project** rooted at `apps/<app>/` with its own
  `capacitor.config.ts` (app ID, name, `webDir`). Capacitor CLI commands only work from inside the
  app directory; the Nx targets (`cap-sync`, `cap-open-ios`, `cap-open-android` in each
  `apps/<app>/project.json`) set that working directory for you.
- **`cap-sync` always builds first** (`dependsOn: build`, configuration forwarded), so the native
  shell never receives a stale or wrong-environment web bundle.
- **There is no Capacitor project at the repository root.** Never run `npx cap init`,
  `npx cap add ios|android`, `npx cap sync` or `pnpm exec cap …` from the repository root — that
  creates a stray, unconfigured project (`capacitor.config.ts` + `ios/` at the root) that is not
  part of this architecture.

---

## 2. Supported Development Environment

Versions marked **pinned** are fixed by repository files. Versions marked **validated** are what the
current state was verified with; they are not enforced by the repository.

### Both platforms

| Tool                           | Requirement                                              | Source                                             |
| ------------------------------ | -------------------------------------------------------- | -------------------------------------------------- |
| Node.js                        | **24** (what CI uses). No `.nvmrc`/`engines` pin exists. | `.github/workflows/ci.yml` → `NODE_VERSION: 24`    |
| pnpm                           | **11.5.3** — pinned                                      | `package.json` → `"packageManager": "pnpm@11.5.3"` |
| Nx                             | 23.0.2 — pinned (installed by pnpm)                      | `package.json`                                     |
| Angular                        | 21.2.x (installed by pnpm)                               | `package.json`                                     |
| Capacitor core/cli/ios/android | **8.5.2** (installed by pnpm)                            | `package.json`, `pnpm-lock.yaml`                   |

> Newer Node majors can build the apps, but Jest's TypeScript config loading fails on Node 26
> (`__dirname is not defined in ES module scope`). Use Node 24 to match CI.

### iOS

| Item                  | Requirement                                                                                                                                                                   | Source                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| macOS                 | Required — Xcode only runs on macOS. Validated on macOS 26.6.                                                                                                                 | —                                                                                              |
| Xcode                 | **Minimum Xcode 16** (the `SentryCapacitor` Swift package declares `swift-tools-version: 6.0`, first shipped in Xcode 16). **Validated: Xcode 27.0 (27A266a), iOS SDK 27.0.** | `@sentry/capacitor` `Package.swift`                                                            |
| iOS deployment target | **iOS 15.0** — pinned                                                                                                                                                         | `project.pbxproj` `IPHONEOS_DEPLOYMENT_TARGET = 15.0`; `CapApp-SPM/Package.swift` `.iOS(.v15)` |
| iOS SDK               | Apps built with current SDKs **must use the UIScene lifecycle** — see [§11](#11-ios-uiscene-requirement).                                                                     | —                                                                                              |
| Dependency manager    | **Swift Package Manager** (`CapApp-SPM`)                                                                                                                                      | `apps/<app>/ios/App/CapApp-SPM/Package.swift`                                                  |
| CocoaPods             | **CocoaPods is NOT required for this project.** There is no `Podfile`. Do not install or introduce it.                                                                        | —                                                                                              |

### Android

| Item                   | Requirement                                                             | Source                                                                     |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| JDK                    | **21** — pinned                                                         | `apps/<app>/android/app/capacitor.build.gradle` → `JavaVersion.VERSION_21` |
| Gradle                 | **8.14.3** — pinned, via the Gradle wrapper (no global Gradle needed)   | `apps/<app>/android/gradle/wrapper/gradle-wrapper.properties`              |
| Android Gradle Plugin  | **8.13.0** — pinned                                                     | `apps/<app>/android/build.gradle`                                          |
| Google Services plugin | 4.4.4 — pinned                                                          | `apps/<app>/android/build.gradle`                                          |
| compileSdk / targetSdk | **36** (Android 16) — pinned                                            | `apps/<app>/android/variables.gradle`                                      |
| minSdk                 | **24** (Android 7.0) — pinned                                           | `apps/<app>/android/variables.gradle`                                      |
| Android Studio         | A current stable release that supports AGP 8.13 and SDK 36. Not pinned. | —                                                                          |

---

## 3. Required Developer Tools

### Required for both

- **Git**
- **Node.js 24** (see §2)
- **pnpm 11.5.3** — the simplest way is Corepack, which reads `packageManager` from `package.json`:

  ```bash
  corepack enable
  corepack prepare pnpm@11.5.3 --activate
  ```

### Required for iOS

- A Mac running a macOS version supported by your Xcode
- **Xcode** (from the Mac App Store or developer.apple.com) — opened once to accept the license and
  install additional components
- **Xcode Command Line Tools** pointed at the full Xcode (see §8)
- An **Apple ID** signed in to Xcode. A free Personal Team is enough for running on your own device;
  the **Apple Developer Program** (paid) is required for TestFlight/App Store and for push
  notifications — see §10 and §19.
- A physical iPhone running iOS 15.0 or later, with a USB cable (or the iOS Simulator, installed
  through Xcode → Settings → Components)
- **Not required:** CocoaPods

### Required for Android

- **Android Studio**
- **JDK 21** (Android Studio's bundled JDK, or a separately installed JDK 21)
- **Android SDK Platform 36**, installed through Android Studio's SDK Manager
- **Android SDK Platform-Tools** (`adb`)
- **Android Emulator** + a system image (optional if you use a physical device)
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) set, and `$ANDROID_HOME/platform-tools` on `PATH`
- For release builds only: a release keystore (see §17) and a Google Play Console account (§19)

### Check your machine

```bash
node -v                    # v24.x
pnpm -v                    # 11.5.3
java -version              # 21 (Android)
xcodebuild -version        # Xcode 16+ (iOS)
adb version                # Android

pnpm run doctor            # repository health check (tools, per-app config, backend)
```

> Use **`pnpm run doctor`**, not `pnpm doctor` — pnpm 11 has its own built-in `doctor` command that
> shadows the repository script.
>
> `pnpm run doctor` reports **"CocoaPods ✖ pod not found"** on a correctly set up Mac. That check is
> stale for this SPM-based project and can be ignored — see §21.

---

## 4. Repository Setup

```bash
git clone <patheya-express-frontend repository URL>
cd frontend
pnpm install --frozen-lockfile
```

`--frozen-lockfile` installs exactly what `pnpm-lock.yaml` records and fails instead of silently
changing it — the same command CI runs.

**Why pnpm (and only pnpm):** the workspace is a pnpm workspace (`pnpm-workspace.yaml`), the
lockfile is `pnpm-lock.yaml`, and — specific to mobile — the generated native files reference
plugins through pnpm's store layout (`node_modules/.pnpm/<package>@<version>_<peers>/…`) in both
`CapApp-SPM/Package.swift` and `android/capacitor.settings.gradle`. Installing with npm or yarn
produces a different `node_modules` layout, and the native projects will not resolve.

Verify the mobile dependency versions:

```bash
pnpm list @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @sentry/capacitor
# @capacitor/* 8.5.2, @sentry/capacitor 4.4.0
```

---

## 5. Environment Configuration

Each mobile app has these Angular environment files in `apps/<app>/src/environments/`, selected at
build time through `fileReplacements` in `apps/<app>/project.json`:

| File                     | Build configuration                    | Used for                                                                    |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------------- |
| `environment.ts`         | `development` (default for `nx serve`) | Local web dev → `http://localhost:3000`                                     |
| `environment.mobile.ts`  | **`mobile`**                           | **Native device/emulator builds** (`pnpm mobile:*`, launcher native builds) |
| `environment.qa.ts`      | `qa`                                   | QA web deployment                                                           |
| `environment.staging.ts` | `staging`                              | Staging web deployment                                                      |
| `environment.prod.ts`    | `production`                           | Production / store release                                                  |

**Why `mobile` exists:** a phone or emulator cannot reach your Mac/PC's `localhost`, so
`environment.mobile.ts` points at a deployed backend instead. Today it points at the deployed QA
API gateway (`https://patheya-express-api-gateway-sg.onrender.com`, `environmentName: 'qa'`). The
backend at that origin must be up for the app to load data.

### Fields (`AppEnvironment`, `libs/shared/core/src/lib/environment/app-environment.ts`)

| Field                                     | Kind                  | Notes                                                                                                                                            |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apiBaseUrl`, `socketUrl`, `mediaBaseUrl` | Public runtime config | Backend origins. Must be reachable from the device.                                                                                              |
| `razorpayKeyId`                           | Public runtime config | Razorpay **key ID** (publishable). Used by `customer-app` checkout only. The Razorpay **key secret** is backend-only and must never appear here. |
| `maps.googleMapsApiKey`                   | Public runtime config | Browser key; must be restricted in Google Cloud (by app/bundle ID and API).                                                                      |
| `sentryDsn`                               | Public runtime config | A Sentry DSN is non-secret by design. Empty ⇒ crash reporting is a no-op.                                                                        |
| `environmentName`, `releaseVersion`       | Build metadata        | `releaseVersion` must match the native version (§19).                                                                                            |

All environment files are **committed and contain only public, client-side values**. Everything in
them ships inside the app bundle and can be extracted from it.

### Secrets — never commit

| Secret                                                                         | Where it belongs                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Android release keystore (`*.jks`, `*.keystore`) and its passwords             | `apps/<app>/android/keystore.properties` (gitignored) locally; CI secret store                                       |
| iOS export options with your Team ID                                           | `apps/<app>/ios/exportOptions.plist` (gitignored)                                                                    |
| Apple signing certificates / provisioning profiles, App Store Connect API keys | Keychain / CI secret store — never the repo                                                                          |
| APNs auth key (`.p8`), FCM server credentials, Razorpay key secret             | Backend secret management — see [`infrastructure/docs/secrets-guide.md`](../../infrastructure/docs/secrets-guide.md) |

`.gitignore` already excludes `keystore.properties`, `*.jks`, `*.keystore`, `exportOptions.plist`,
`xcuserdata/`, `DerivedData/`, `Pods/`, native `build/` folders and the synced `public/` web assets.

### Live reload against a local dev server (optional)

`capacitor.config.ts` honours `CAP_SERVER_URL` so the native shell loads a dev server on your LAN
instead of the bundled assets — see [`CAPACITOR.md` §7](./CAPACITOR.md#live-reload). Never sync a
release build with `CAP_SERVER_URL` set, and never commit a machine IP into an environment file.

---

## 6. Build the Web Application for Mobile

```bash
pnpm mobile:build
```

Runs `nx run-many --target=build --projects=customer-app,restaurant-app,delivery-app
--configuration=mobile`: production-optimised Angular builds for the three mobile apps using
`environment.mobile.ts`, written to `dist/apps/<app>/browser`.

You normally don't need to run this separately — every `pnpm mobile:sync:*` command builds its app
first. It is useful as a quick "does everything compile" check. Never copy `dist/` folders into the
native projects by hand; sync does that.

---

## 7. Capacitor Sync

```bash
pnpm mobile:sync:customer     # nx run customer-app:cap-sync   --configuration=mobile
pnpm mobile:sync:partner      # nx run restaurant-app:cap-sync --configuration=mobile
pnpm mobile:sync:delivery     # nx run delivery-app:cap-sync   --configuration=mobile
pnpm mobile:sync              # all three
```

Each one builds the app (`mobile` configuration) and then runs `npx cap sync` inside `apps/<app>/`,
which:

1. Copies `dist/apps/<app>/browser` into the iOS and Android projects.
2. Writes `capacitor.config.json` into each native project.
3. Regenerates the plugin wiring:
   - **iOS:** `ios/App/CapApp-SPM/Package.swift` — a local Swift package that lists every Capacitor
     plugin (by its path under `node_modules/.pnpm/…`) and pins `capacitor-swift-pm` to exactly the
     installed `@capacitor/ios` version.
   - **Android:** `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`.

**Sync again whenever** you pull changes, change any dependency, change `capacitor.config.ts` or an
environment file, or change web code you want to see in the native app.

**Review generated changes.** `Package.swift`, `capacitor.settings.gradle` and `Package.resolved` are
committed. After a dependency change they legitimately change (new versions or pnpm paths) and must
be committed together with `package.json`/`pnpm-lock.yaml`. If sync changes them when no dependency
changed, check your pnpm install before committing.

> **Windows checkouts:** sync writes host-specific paths (backslashes, shorter pnpm folder names).
> Do not commit `Package.swift` regenerated on Windows — it won't resolve on macOS.

**Release build sync:** the `pnpm mobile:sync:*` scripts always use the `mobile` (QA) configuration.
To package another environment, call the Nx target directly — the configuration is forwarded to the
build:

```bash
pnpm exec nx run customer-app:cap-sync --configuration=production
```

---

## 8. iOS Setup — First Time

1. **Install Xcode** (16 or later; see §2), open it once, accept the license and let it install
   components. Install an iOS Simulator runtime from Xcode → Settings → Components if you want one.
2. **Point the command-line tools at Xcode** (needed if `xcode-select` points at the standalone
   Command Line Tools):

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   ```

   Without `sudo`, prefix individual commands with
   `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` instead.

3. **Install and sync** (see §4 and §7):

   ```bash
   pnpm install --frozen-lockfile
   pnpm mobile:sync:customer
   ```

4. **Resolve Swift packages** (Xcode also does this automatically when the project opens):

   ```bash
   cd apps/customer-app/ios/App
   xcodebuild -resolvePackageDependencies -project App.xcodeproj
   cd ../../../..
   ```

   Expect `capacitor-swift-pm @ 8.5.2` and `Sentry: https://github.com/getsentry/sentry-cocoa @ 9.28.0`.

5. **Open the existing project:**

   ```bash
   pnpm mobile:ios:customer      # apps/customer-app/ios/App/App.xcodeproj
   pnpm mobile:ios:partner       # apps/restaurant-app/ios/App/App.xcodeproj
   pnpm mobile:ios:delivery      # apps/delivery-app/ios/App/App.xcodeproj
   ```

6. **Sign in:** Xcode → Settings → Accounts → **+** → Apple ID.
7. **Select the team:** in the project navigator select **App** → target **App** → **Signing &
   Capabilities** → **Team** → your team. Do not change the Bundle Identifier.
8. Leave **Automatically manage signing** enabled (the project uses `CODE_SIGN_STYLE = Automatic`).
9. **Connect your iPhone** with a cable and unlock it.
10. **Trust the Mac:** on the iPhone, tap **Trust** on the "Trust This Computer?" prompt and enter
    the passcode.
11. **Enable Developer Mode** on the iPhone — see §9.
12. **Select the device:** in the Xcode toolbar's run-destination menu choose **`<Your iPhone>`**
    (it appears under "iOS Device" by the name set in the phone's Settings → General → About).
13. **Run:** press **⌘R** (Product → Run). The first install can take a while because Xcode copies
    debug symbols for the phone's iOS version.
14. If iOS says the developer is not trusted, follow §10 "Trusting the developer on the device", then
    run again.

You can confirm the device is visible from the terminal:

```bash
xcrun devicectl list devices
```

---

## 9. iOS Developer Mode

iOS refuses to launch development-signed apps unless Developer Mode is on:

**iPhone: Settings → Privacy & Security → Developer Mode → On**

- The phone **restarts**. After it restarts, unlock it and confirm **Turn On** when prompted.
- The **Developer Mode** row only appears after the phone has been connected to a Mac running Xcode
  (or has had a development app installed). If you don't see it, connect the phone, open Xcode, and
  select the phone as a run destination once.
- Without Developer Mode, Xcode reports the device as unavailable ("Developer Mode disabled"), or the
  app installs but cannot be launched for development.

---

## 10. iOS Signing & Trust

### Development on your own device

| Concept                          | What it is in this project                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Apple ID**                     | Signed in under Xcode → Settings → Accounts                                                                                                                                                                                  |
| **Development Team**             | Chosen per developer in Signing & Capabilities. The committed project has **no team set**, so each developer selects their own. This change is local; do not commit it unless the team agrees on a shared organization team. |
| **Automatically manage signing** | Enabled. Xcode creates the development certificate and an "iOS Team Provisioning Profile" for the bundle ID                                                                                                                  |
| **Bundle ID**                    | Fixed per app (§1)                                                                                                                                                                                                           |
| **Provisioning**                 | Managed by Xcode; nothing to download by hand                                                                                                                                                                                |

**Trusting the developer on the device** (needed the first time an app signed by a given account
runs, mainly with a free Personal Team): if iOS shows "Untrusted Developer", go to **Settings →
General → VPN & Device Management → (your Apple ID under Developer App) → Trust**, then launch again.

**Personal Team (free Apple ID) limits:**

- Provisioning profiles expire after **7 days**; re-run from Xcode to re-sign.
- Only a few devices and a few app IDs are allowed.
- A bundle ID can be registered by only one team. If another team already owns
  `com.patheyaexpress.*`, a Personal Team cannot use it — you must join that team.
- **No Push Notifications capability** and no other paid-only capabilities.
- **No TestFlight, no App Store distribution.**

### TestFlight / App Store distribution

A Personal Team is **never sufficient** for release. Distribution needs a paid **Apple Developer
Program** organization team, the App IDs registered under it, an Apple Distribution certificate,
App Store provisioning, and an App Store Connect app record — see §19. For CLI exports, copy
`apps/<app>/ios/exportOptions.plist.example` to `exportOptions.plist` (gitignored) and set the
organization Team ID.

---

## 11. iOS UIScene Requirement

### Symptom

On a physical iPhone, an app built with the current iOS SDK refused to launch:

```
Application failed to launch: UIScene life cycle is required for apps built with this SDK.
```

### Cause

Current iOS SDKs require the **scene-based lifecycle** (`UIApplicationSceneManifest` +
`UISceneDelegate`). The Capacitor iOS template the apps were created from used the old
app-delegate–only lifecycle, and Capacitor iOS **8.4.x has no scene support**. Scene support
(`SceneDelegateProxy`, scene-aware app pause/resume events) first shipped in **Capacitor 8.5.0**.

### Resolution (applied to `customer-app`)

1. `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` and `@capacitor/android` were upgraded to
   **8.5.2**. No plugin versions changed.
2. Capacitor CLI 8.5.2's official UIScene migration (`migrateToUIScene`, the iOS step of
   `cap migrate`) was applied to the Customer iOS project. It changed:

| File (`apps/customer-app/ios/App/…`) | Change                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App/Info.plist`                     | Added `UIApplicationSceneManifest` → one window scene, `UISceneDelegateClassName = $(PRODUCT_MODULE_NAME).SceneDelegate`, `UISceneStoryboardFile = Main`, multiple scenes off |
| `App/SceneDelegate.swift`            | New — Capacitor's template: creates the window with `CAPBridgeViewController` and forwards scene connect/URL/universal-link events to `SceneDelegateProxy.shared`             |
| `App/AppDelegate.swift`              | Added `application(_:configurationForConnecting:options:)` returning the `SceneDelegate` configuration                                                                        |
| `App.xcodeproj/project.pbxproj`      | Registers `SceneDelegate.swift` in the App target's Sources                                                                                                                   |

Deep links (`patheyaexpress://…`) keep working: `SceneDelegateProxy` still posts Capacitor's existing
URL-open notifications, which `@capacitor/app` listens for.

`cap migrate` itself was **not** run: it would also upgrade every official plugin and rewrite the
Android Gradle files, and its own output says it is not intended for monorepos.

**Restaurant and Delivery have not been migrated yet** and will fail on a physical device with the
same message until the same step is applied to `apps/restaurant-app` and `apps/delivery-app` (§21).

Don't remove the scene manifest or `SceneDelegate.swift` from the Customer app, and don't use
workarounds such as building with an older SDK.

---

## 12. iOS Sentry / Swift Package Requirement

Validated combination:

| Package                            | Version    |
| ---------------------------------- | ---------- |
| `@sentry/capacitor` (npm)          | **4.4.0**  |
| `sentry-cocoa` (Swift package)     | **9.28.0** |
| `@sentry/angular` / `@sentry/core` | 10.69.0    |

Why: `@sentry/capacitor`'s native iOS code calls `PrivateSentrySDKOnly`, which `sentry-cocoa`
**removed in 9.29.0**. `@sentry/capacitor` 4.3.0 allowed any 9.x of `sentry-cocoa` (`from:
"9.16.1"`), so Swift Package Manager picked 9.30.0 and the build failed with
`Cannot find 'PrivateSentrySDKOnly' in scope`. `@sentry/capacitor` 4.4.0 pins `sentry-cocoa`
**`exact: "9.28.0"`** in its own `Package.swift`, which fixes it.

Rules:

- The **source of truth** is `@sentry/capacitor`'s version in `package.json`/`pnpm-lock.yaml`. The
  Sentry version follows from it. Upgrade Sentry by upgrading `@sentry/capacitor` together with
  `@sentry/angular`, which it requires at the exact same version.
- **Never hand-edit `Package.resolved`.** It is committed
  (`App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`) and is regenerated
  by Xcode or by `xcodebuild -resolvePackageDependencies`.
- Do not use CocoaPods (`@sentry/capacitor` 4.4.0 no longer ships a podspec at all).
- Crash reporting only runs when the environment's `sentryDsn` is set (§5, §21).

---

## 13. iOS Troubleshooting

| Problem                                                                                                            | Fix                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **"Signing for "App" requires a development team"**                                                                | Signing & Capabilities → select a Team (§8 step 7).                                                                                                                                                                                              |
| **"Failed to register bundle identifier" / "No profiles for 'com.patheyaexpress.…'"**                              | The bundle ID is owned by another team, or a Personal Team has hit its limit. Join the organization team that owns the ID. Don't change the bundle ID to work around it.                                                                         |
| **"Untrusted Developer"** on launch                                                                                | Settings → General → VPN & Device Management → Trust (§10).                                                                                                                                                                                      |
| **"Developer Mode disabled"** / device greyed out                                                                  | §9.                                                                                                                                                                                                                                              |
| **iPhone not listed in Xcode**                                                                                     | Unlock the phone, reconnect the cable, accept **Trust This Computer**, open Window → Devices and Simulators, and wait for "Preparing device / copying shared cache" to finish. Check with `xcrun devicectl list devices`.                        |
| **"Trust This Computer?" never appears**                                                                           | Unplug and replug while unlocked. If it was previously declined: Settings → General → Transfer or Reset iPhone → Reset → Reset Location & Privacy, then reconnect.                                                                               |
| **"UIScene life cycle is required for apps built with this SDK"**                                                  | The app is missing the scene migration (§11). For Customer, confirm `Info.plist` has `UIApplicationSceneManifest` and `SceneDelegate.swift` is in the target. Restaurant/Delivery are not migrated yet.                                          |
| **Swift package resolution fails / packages missing**                                                              | Run `pnpm install --frozen-lockfile` and `pnpm mobile:sync:<app>` first (local plugin paths point into `node_modules/.pnpm`). Then in Xcode: **File → Packages → Resolve Package Versions**.                                                     |
| **"… xcframework.zip already exists in file system"** / **Sentry.xcframework missing** / "No such module 'Sentry'" | Stale Swift package artifacts in DerivedData (typically after a dependency version change). Xcode: **File → Packages → Reset Package Caches**, then **Product → Clean Build Folder** (⇧⌘K). If that still fails, see the next row.               |
| **DerivedData corruption** (persistent odd build errors)                                                           | Quit Xcode, delete **this project's** DerivedData folder (Xcode → Settings → Locations shows the path; the folder starts with `App-`), reopen, let packages resolve, rebuild. This is a troubleshooting step only, not part of the normal build. |
| **`Cannot find 'PrivateSentrySDKOnly' in scope`**                                                                  | `sentry-cocoa` resolved to 9.29+. Check `pnpm list @sentry/capacitor` shows 4.4.0 and resolve packages again (§12). Don't edit `Package.resolved`.                                                                                               |
| **`pod: command not found`**                                                                                       | Expected — CocoaPods isn't used. If it comes from `pnpm <app>:ios` (launcher), use `pnpm mobile:ios:<app>` instead (§21).                                                                                                                        |
| **`xcodebuild` says it requires Xcode, but the active developer directory is Command Line Tools**                  | §8 step 2.                                                                                                                                                                                                                                       |

---

## 14. Android Setup — First Time

> Android has **not yet been validated** on a physical device or emulator in this repository (§21).
> The steps below follow the committed native configuration.

1. **Install Android Studio** (current stable; §2).
2. **JDK 21:** Android Studio → Settings → Build, Execution, Deployment → Build Tools → Gradle →
   **Gradle JDK** = a JDK 21 (the bundled JBR 21 or an installed JDK 21).
3. **Android SDK** (Android Studio → Settings → Languages & Frameworks → Android SDK):
   - SDK Platforms: **Android 16 (API 36)**
   - SDK Tools: **Android SDK Platform-Tools**, **Android SDK Build-Tools**, **Android Emulator**
4. **Environment variables** (macOS/zsh example; adjust the SDK path to yours):

   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$PATH:$ANDROID_HOME/platform-tools"
   ```

   Then check with `adb version` and `pnpm run doctor`.

5. **Emulator (optional):** Device Manager → create a virtual device with an API 36 system image.
6. **Physical device:** §16.
7. **Gradle:** comes from the wrapper (`gradlew`, Gradle 8.14.3). No global Gradle install is needed.
   The first sync downloads Gradle and dependencies.
8. **Signing:** debug builds need nothing. Release builds: §17.

---

## 15. Android Build Workflow

```bash
pnpm install --frozen-lockfile

pnpm mobile:sync:customer          # build (mobile config) + cap sync
pnpm mobile:android:customer       # open apps/customer-app/android in Android Studio

pnpm mobile:sync:partner           # Restaurant / Partner
pnpm mobile:android:partner        # apps/restaurant-app/android

pnpm mobile:sync:delivery
pnpm mobile:android:delivery       # apps/delivery-app/android
```

In Android Studio, wait for the Gradle sync to finish, pick a device or emulator, and press **Run**.

Command-line equivalents from the app's `android/` folder (standard Gradle wrapper tasks):

```bash
cd apps/customer-app/android
./gradlew assembleDebug            # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug             # install on the connected device/emulator
./gradlew bundleRelease            # Play Store bundle (.aab) — needs release signing (§17)
```

`gradlew` is committed **without the executable bit** (the projects were scaffolded on Windows), so
on macOS/Linux `./gradlew` fails with "permission denied" until you run
`chmod +x apps/<app>/android/gradlew` (Android Studio is not affected).

Alternatively, the launcher builds, syncs and launches in one command (`pnpm customer:android`,
`pnpm partner:android`, `pnpm delivery:android`). See
[`tools/launcher/README.md`](../../tools/launcher/README.md).

---

## 16. Android Physical Device

1. **Enable Developer Options:** Settings → About phone → tap **Build number** seven times.
2. **Enable USB debugging:** Settings → System → Developer options → **USB debugging** (the exact
   menu path varies by manufacturer).
3. Connect over USB, unlock the phone, and accept **"Allow USB debugging?"** (tick "Always allow from
   this computer").
4. Check it's connected:

   ```bash
   adb devices
   # List of devices attached
   # R5CX1234ABC    device
   ```

   `device` means it's ready. `unauthorized` or `offline` → §18.

5. Select the device in Android Studio and press **Run**.

The device needs Android 7.0 (API 24) or later. The app loads data from the QA backend (§5), so the
phone needs internet access.

---

## 17. Android Signing

| Build                                                | Signing                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Debug** (`assembleDebug`, Run from Android Studio) | Android's auto-generated debug keystore (`~/.android/debug.keystore`). Nothing to configure.                                                                                                                                                  |
| **Release** (`assembleRelease`, `bundleRelease`)     | `apps/<app>/android/app/build.gradle` loads `apps/<app>/android/keystore.properties` if it exists and signs with it. **If the file is missing it silently falls back to the debug keystore.** Such a build cannot be uploaded to Google Play. |

Set up release signing per app:

```bash
cp apps/customer-app/android/keystore.properties.example apps/customer-app/android/keystore.properties
```

```properties
# apps/<app>/android/keystore.properties — gitignored, never commit
storeFile=../patheya-express-customer-release.jks   # path relative to android/app/
storePassword=<from secret manager>
keyAlias=patheya-express-customer
keyPassword=<from secret manager>
```

- Store the keystore file and its passwords in the team's secret manager. **Losing the upload key
  without Play App Signing means you can no longer update the app.**
- **CI/CD:** keep the keystore as a base64 secret plus password secrets. Have the job write
  `keystore.properties` and the `.jks` file before `bundleRelease`, and delete them afterwards. No
  Android release pipeline exists in this repository yet.
- Each app (customer/partner/delivery) should have its own key/alias.

---

## 18. Android Troubleshooting

| Problem                                                                       | Fix                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adb devices` shows **unauthorized**                                          | Unlock the phone and accept the USB-debugging prompt. If no prompt appears: Developer options → **Revoke USB debugging authorizations**, then `adb kill-server && adb start-server` and reconnect.     |
| **Device not detected**                                                       | Use a data-capable cable, set USB mode to File transfer, check USB debugging is on, and try `adb kill-server && adb start-server`.                                                                     |
| **SDK location not found** / `ANDROID_HOME not set`                           | Install SDK Platform 36 (§14) and set `ANDROID_HOME`. Android Studio can also write `android/local.properties` (`sdk.dir=…`), which is gitignored.                                                     |
| **JDK mismatch** (`Unsupported class file major version`, "requires Java 21") | Set Gradle JDK to 21 (§14 step 2). From the terminal, `JAVA_HOME` must point to JDK 21.                                                                                                                |
| **Gradle sync/build failure after pulling**                                   | Run `pnpm install --frozen-lockfile` and `pnpm mobile:sync:<app>` first: `capacitor.settings.gradle` points at plugin folders inside `node_modules/.pnpm`. Then File → Sync Project with Gradle Files. |
| **Capacitor sync problems**                                                   | Always use `pnpm mobile:sync:<app>`, never `npx cap sync` from the repository root. Check `apps/<app>/capacitor.config.ts` exists and the build succeeded.                                             |
| **Plugin incompatibility / version mismatch warnings**                        | `@capacitor/core`, `cli`, `android` and `ios` must share one version (8.5.2). Plugins must be on major 8. Check with `pnpm list @capacitor/core @capacitor/android`.                                   |
| **Stale build artifacts**                                                     | `cd apps/<app>/android && ./gradlew clean`, or in Android Studio: Build → Clean Project. Then re-sync.                                                                                                 |
| `google-services.json not found … Push Notifications won't work` (Gradle log) | Expected for restaurant/delivery today (§21). Push needs that app's Firebase config file.                                                                                                              |

---

## 19. Production Release Prerequisites

Status key: ✅ present in the repo · ⚠️ present but needs action · ❌ not configured yet.

### iOS (App Store / TestFlight)

| Prerequisite                                                                                                                             | Status                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Apple Developer Program **organization** membership                                                                                      | ❌ Not configured in the repo. A Personal Team cannot release.                                  |
| App IDs `com.patheyaexpress.customer` / `.partner` / `.delivery` registered under the org team                                           | ❌                                                                                              |
| App Store Connect app records                                                                                                            | ❌                                                                                              |
| Apple Distribution certificate + App Store provisioning (automatic signing is fine)                                                      | ❌                                                                                              |
| `exportOptions.plist` with the org Team ID (from `.example`, gitignored)                                                                 | ⚠️ Template only                                                                                |
| **Push Notifications** capability (`aps-environment` entitlement) + APNs key uploaded to the push provider                               | ❌ No entitlements file exists; the capability must be added in Xcode under a paid team.        |
| UIScene lifecycle                                                                                                                        | ✅ Customer · ❌ Restaurant, Delivery                                                           |
| Version: `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` in `project.pbxproj`, kept in sync with `releaseVersion` in the environment files | ⚠️ All `1.0` / `1`; bump per release                                                            |
| App icons and launch images                                                                                                              | ⚠️ Capacitor placeholders ([`CAPACITOR.md` §10](./CAPACITOR.md#10-remaining-risks--follow-ups)) |
| Privacy usage strings (location, camera, photo library — Customer)                                                                       | ✅ in `Info.plist`                                                                              |
| App Privacy details and privacy policy URL in App Store Connect                                                                          | ❌ Outside the repo                                                                             |
| Production web bundle: `pnpm exec nx run <app>:cap-sync --configuration=production`, then Product → Archive                              | ✅ Workflow exists                                                                              |

### Android (Google Play)

| Prerequisite                                                                                                 | Status                                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Google Play Console developer account + app entries                                                          | ❌ Not configured in the repo              |
| Application IDs (`com.patheyaexpress.customer` / `.partner` / `.delivery`)                                   | ✅ `android/app/build.gradle`              |
| Release keystore + `keystore.properties` per app                                                             | ⚠️ Template only (§17)                     |
| **Play App Signing** enrolled (upload key = your keystore)                                                   | ❌ Done in Play Console                    |
| `versionCode`/`versionName` bumped per release (`android/app/build.gradle`)                                  | ⚠️ `1` / `1.0`                             |
| Firebase `google-services.json` for push (FCM)                                                               | ⚠️ Customer only · ❌ Restaurant, Delivery |
| Release build (`./gradlew bundleRelease`) after `pnpm exec nx run <app>:cap-sync --configuration=production` | ⚠️ Not yet run (§21)                       |
| App icons and splash                                                                                         | ⚠️ Placeholders                            |
| Data safety form, content rating, privacy policy                                                             | ❌ Outside the repo                        |

### Both — production configuration (`environment.prod.ts`)

| Item                                                                    | Status                                                                                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiBaseUrl`/`socketUrl`/`mediaBaseUrl` point at the production backend | ⚠️ Today they are the same origin as QA/mobile (`patheya-express-api-gateway-sg.onrender.com`). Confirm this is the intended production origin. |
| `razorpayKeyId`                                                         | ⚠️ **Customer uses a test key (`rzp_test_…`)**. Replace with the live key ID before launch; the live key secret goes on the backend.            |
| `maps.googleMapsApiKey`                                                 | ⚠️ Empty in the mobile/qa/staging/production configs; set a restricted key if map features are required.                                        |
| `sentryDsn`                                                             | ⚠️ Empty in every environment, so crash reporting is off. Set per-app DSNs.                                                                     |
| Never ship with `CAP_SERVER_URL` set                                    | Check before every release sync                                                                                                                 |

---

## 20. Pre-Launch Checklist

**Environment**

- [ ] Node 24, pnpm 11.5.3 (`node -v`, `pnpm -v`)
- [ ] `pnpm run doctor` is clean (ignore the CocoaPods line, §21)

**Dependencies**

- [ ] `pnpm install --frozen-lockfile` succeeds without lockfile changes
- [ ] `@capacitor/core|cli|ios|android` all 8.5.2; plugins on major 8
- [ ] `@sentry/capacitor` 4.4.0 and `sentry-cocoa` 9.28.0 in every `Package.resolved`

**Build**

- [ ] `pnpm mobile:build` succeeds
- [ ] `pnpm exec nx run <app>:cap-sync --configuration=production` for release builds
- [ ] No unexpected diffs in `Package.swift`, `capacitor.settings.gradle`, `Package.resolved`

**Configuration**

- [ ] `environment.prod.ts` API/socket/media origins are production
- [ ] `CAP_SERVER_URL` not set
- [ ] `releaseVersion` matches native versions

**Signing**

- [ ] iOS: organization team, distribution signing, `exportOptions.plist` (not committed)
- [ ] Android: release keystore in the secret manager, `keystore.properties` present only locally/in CI

**iOS**

- [ ] Every shipped app has the UIScene migration (§11)
- [ ] Push Notifications capability added
- [ ] Version/build numbers bumped
- [ ] Archive and TestFlight install on a physical device

**Android**

- [ ] `bundleRelease` signed with the release key (not the debug fallback)
- [ ] Installed and tested on a physical device (§16)
- [ ] `versionCode` bumped

**API/backend**

- [ ] Production backend healthy and reachable from mobile networks (HTTPS)
- [ ] CORS/WebSocket origins allow the Capacitor origins (`capacitor://localhost` on iOS, `https://localhost` on Android)

**Payments**

- [ ] Live Razorpay key ID in `environment.prod.ts` (Customer); live key secret configured only on the backend
- [ ] End-to-end live payment tested

**Push notifications**

- [ ] iOS: APNs key and `aps-environment` entitlement · Android: `google-services.json` per app
- [ ] Notification received on physical iOS and Android devices

**Deep links**

- [ ] `patheyaexpress://` opens the Customer app and routes correctly on iOS (through `SceneDelegate`) and Android

**Location**

- [ ] Permission prompt text is correct, and nearby restaurants load on device

**Sentry**

- [ ] Production DSN set per app; a test event arrives in Sentry from each platform

**Production security**

- [ ] No secrets in environment files or the repo; Maps key restricted; `allowMixedContent` stays `false`

**Store release**

- [ ] Icons/splash replaced, store listings, privacy declarations, screenshots

---

## 21. Known Current Limitations

Verified facts as of this document:

- **Customer iOS is validated on a physical iPhone.** A signed debug build was installed and launched
  on an iPhone 16 Pro Max (Xcode 27.0, iOS SDK 27.0, development-signed with a Personal Team) and
  kept running. It also built for the generic iOS device and the iOS Simulator, with
  `capacitor-swift-pm` 8.5.2 and `sentry-cocoa` 9.28.0.
- **Restaurant and Delivery iOS** compile (generic iOS device build) but **have not been migrated to
  UIScene**, so they will fail to launch on a physical device with "UIScene life cycle is required"
  until §11's migration is applied to them.
- **Android has not been built or run** in this repository on a real toolchain: no `gradlew` build,
  emulator or physical-device launch has been verified yet. Treat §14–§18 as the configured path,
  not a proven one.
- **`pnpm <app>:ios` (launcher) requires CocoaPods.** The launcher's environment validation has a
  blocking "CocoaPods" check, so `pnpm customer:ios`, `pnpm partner:ios` and `pnpm delivery:ios`
  stop at validation on a Mac without `pod`, even though the projects use SPM. Use
  `pnpm mobile:sync:<app>` + `pnpm mobile:ios:<app>` until the launcher check is updated. Do not
  install CocoaPods to get past it.
- **No Development Team is committed** to the iOS projects. Each developer selects their own (§10).
- **Production distribution is not configured:** no Apple Developer Program team, App Store Connect
  records, Play Console, release keystores or push credentials are set up (§19).
- **Push notifications:** iOS has no Push capability/entitlement in any app; Android has
  `google-services.json` for Customer only.
- **Sentry is off** in every environment (empty `sentryDsn`).
- **Customer payments use a Razorpay test key** in every environment, including production.
- **Native versions are all `1.0` (build `1`)** and must be bumped manually in both native projects
  and `releaseVersion`.
