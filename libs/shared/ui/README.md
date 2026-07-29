# @patheya-express-frontend/ui

The **only** UI library for `customer-app`, `restaurant-app`, `delivery-app` and `admin-app`.
Previously there were two (`shared-ui` for web, a separate `mobile-ui` for the Capacitor native
shells); `mobile-ui` was unified into this library and deleted. This document records that
unification — what moved, what merged, what stayed platform-specific, and why.

## 1. Files moved

Everything under `libs/shared/mobile-ui/src/lib/` moved here, mostly flattened (dropping its old
`components/`/`navigation`/`layout` wrapper folders to match this library's existing flat
`lib/<name>/` convention), with three exceptions kept as their own top-level folders because the
brief specifically asked for platform-separated structure:

| From (`mobile-ui`) | To (`shared-ui`) |
|---|---|
| `lib/tokens/*.ts` | `lib/tokens/*.ts` |
| `lib/types/*.ts` | `lib/types/*.ts` |
| `lib/utils/*.ts` | `lib/utils/*.ts` |
| `lib/animations/*` | `lib/animations/*` (now `@use`d by `theme.scss` automatically) |
| `lib/directives/*.ts` | `lib/directives/*.ts` |
| `lib/pipes/*.ts` | `lib/pipes/*.ts` |
| `lib/services/*.ts` (except network-status) | `lib/services/*.ts` |
| `lib/services/network-status.service.ts` | `lib/services/network-status.service.ts` (unchanged location — see §7 for why it did *not* move to `shared-core`) |
| `lib/components/buttons/*` | `lib/buttons/*` |
| `lib/components/cards/*` | `lib/cards/*` |
| `lib/components/badge`, `divider`, `loading-overlay`, `progress-indicator`, `toast`, `snackbar`, `bottom-sheet`, `offline-banner`, `network-status`, `list-tile` | same names, flattened to `lib/<name>/` |
| `lib/navigation/{modal,bottom-sheet,dialog,toast}-host` | `lib/overlays/{modal,bottom-sheet,dialog,toast}-host` |
| `lib/layout/mobile-shell`, `safe-area-layout`, `page-container`, `scrollable-page`, `section`, `bottom-action-bar`, `top-app-bar`, `floating-button` + `lib/navigation/bottom-tabs` | `lib/layouts/mobile/*` |
| `mobile-tokens.scss`'s CSS custom properties | merged directly into `src/theme.scss` (§4) |

`tsconfig.base.json`'s `@patheya-express-frontend/mobile-ui` path mapping was removed; nothing
else in the workspace ever referenced it (`mobile-ui` had zero consumers before this refactor).

## 2. Files removed

- `libs/shared/mobile-ui/` — the entire library, deleted.
- `libs/shared/mobile-ui/src/lib/components/chip/chip.component.ts` — merged into
  `StatusChipComponent` (§3), not relocated.
- `libs/shared/mobile-ui/src/lib/components/search/search-field.component.ts` — merged into
  `SearchInputComponent` (§3), not relocated.
- `libs/shared/mobile-ui/src/lib/components/confirmation-dialog/confirmation-dialog.component.ts`
  — replaced by `ConfirmDialogOverlayComponent`, a thin adapter over the existing
  `ConfirmDialogComponent` (§3), not a relocation of the old implementation.

## 3. Files modified — merged components

Five `shared-ui` components already had 40–60+ consumers across `libs/features/*`. Every change
below is **additive only** — new optional inputs/outputs with defaults that reproduce the exact
previous behavior — verified by rebuilding every app and confirming zero visual/behavioral
change is required at any existing call site.

| Component | What was added | Existing API touched? |
|---|---|---|
| `EmptyStateComponent` (`empty-state/`) | `showDefaultIllustration` input + `libIcon` content-projection slot, for a custom icon | No — defaults preserve the built-in SVG exactly |
| `ErrorStateComponent` (`error-state/`) | Same `showDefaultIllustration`/`libIcon` pattern + `retryLabel` input | No — `retryLabel` defaults to the previously-hardcoded `'Try again'` |
| `SkeletonComponent` (`skeleton/`) | `variant: 'card-grid' \| 'block'` (default `'card-grid'`) + `shape`/`width`/`height`, for a single-primitive placeholder instead of the fixed card grid | No — default variant renders the identical card-grid markup |
| `StatusChipComponent` (`status-chip/`) | `selectable`/`selected`/`removable` inputs + `chipClick`/`removed` outputs — this is now the **one** chip/badge-pill component (mobile-ui's separate generic `ChipComponent` was deleted, not relocated) | No — `selectable`/`removable` default `false`, so every existing read-only status pill renders and behaves identically |
| `SearchInputComponent` (`search-input/`) | `disabled` + optional `ariaLabel` (falls back to `placeholder`) | No — both are additive; debounced `valueChange` behavior unchanged |

`ConfirmDialogComponent` (`confirm-dialog/`) itself was **not modified** beyond swapping one
hardcoded `z-index: 1000` for `var(--z-index-dialog, 1000)` (§9) — it already had a fuller API
(`open`/`busy`/`tone`/etc.) than mobile-ui's equivalent, so mobile-ui's version was discarded
entirely in favor of it (§5).

## 4. Design tokens — one system

`mobile-tokens.scss`'s custom properties (touch targets, elevation, z-index, dark theme, motion
durations/easings) were merged directly into the existing `src/theme.scss`, in the same `:root`
block as spacing/radius/typography/color — there is now exactly one token file, not two. TS
mirrors (`MOBILE_Z_INDEX`, `MOBILE_MOTION_DURATIONS_MS`, `MOBILE_TOUCH_TARGET_PX`) live in
`lib/tokens/`. `theme.scss` also now `@use`s `lib/animations/keyframes.scss`, so every app's
existing single `@use '.../theme'` import gets the animation keyframes/utility classes for free —
no second import to remember.

## 5. Components merged (the concrete "duplicate → one" list)

| Concept | Kept | Duplicate eliminated |
|---|---|---|
| Empty state | `EmptyStateComponent` | mobile-ui's `EmptyStateComponent` |
| Error state | `ErrorStateComponent` | mobile-ui's `ErrorStateComponent` |
| Skeleton loader | `SkeletonComponent` | mobile-ui's `SkeletonLoaderComponent` |
| Chip / status pill | `StatusChipComponent` | mobile-ui's `ChipComponent` |
| Search field | `SearchInputComponent` | mobile-ui's `SearchFieldComponent` |
| Confirmation dialog | `ConfirmDialogComponent` (unchanged) + new `ConfirmDialogOverlayComponent` adapter | mobile-ui's `ConfirmationDialogComponent` (had its own duplicate backdrop/card markup) |

Everything else in mobile-ui's catalog (buttons, cards, badge, divider, loading-overlay,
progress-indicator, toast, snackbar, bottom-sheet, list-tile, the mobile shell/layout set) had
**no shared-ui equivalent** — see §8 for why the cards aren't duplicates of `libs/features/*`'s
domain-bound cards either — so those were relocations, not merges.

## 6. Duplicate code eliminated

- Two design-token files → one (`theme.scss`, §4).
- Two chip/pill implementations → one (`StatusChipComponent`, §3/§5).
- Two search-field implementations → one (`SearchInputComponent`, §3/§5).
- Two confirmation-dialog UIs → one (`ConfirmDialogComponent`); `DialogHostComponent` was
  redesigned to render **no chrome of its own** specifically so it wouldn't duplicate
  `ConfirmDialogComponent`'s own backdrop/centering (see its doc comment) — a dialog opened via
  `DialogService` is expected to be fully self-presenting, the same contract
  `ConfirmDialogComponent` already satisfied.
- Two empty/error-state illustrations → one each (default SVG retained, now with an optional
  override slot instead of a parallel component).
- One hardcoded `z-index: 1000` in `ConfirmDialogComponent` → `var(--z-index-dialog)` (§4).
- Selector prefixes unified: every relocated component that's genuinely platform-agnostic
  (buttons, cards, badge, toast, snackbar, bottom sheet, overlay hosts, …) was renamed from its
  old `mobile-*` tag to this library's existing `lib-*` convention. Only `layouts/mobile/*`
  (`MobileShellComponent`, `TopAppBarComponent`, `BottomTabsComponent`, `FloatingButtonComponent`,
  …) kept `mobile-*`, deliberately — those *are* the native-shell-specific chrome, so the tag name
  signals that. `eslint.config.mjs`'s selector rule now accepts both prefixes for that reason.

## 7. Final shared-ui architecture

```
libs/shared/ui/src/
  theme.scss                    ← the one design-token file (+ @use's animations/keyframes.scss)
  lib/
    tokens/        types/        utils/        animations/     ← TS mirrors, shared contracts, keyframes
    services/                                                  ← overlay stacks (Modal/BottomSheet/
                                                                   Dialog/Toast) + MobileNavigationService
                                                                   + NetworkStatusService (kept here, not
                                                                   shared-core — see below)
    directives/     pipes/                                     ← gesture/behavior directives, formatting pipes
    buttons/        cards/          badge/         chip → status-chip/
    divider/        loading-overlay/ progress-indicator/
    toast/          snackbar/       bottom-sheet/  list-tile/
    offline-banner/ network-status/ search-bar/    search-input/
    empty-state/    error-state/    skeleton/      confirm-dialog/
    overlays/       ← ModalHost, BottomSheetHost, DialogHost, ToastHost, ConfirmDialogOverlay
    layouts/
      mobile/       ← MobileShell, SafeAreaLayout, PageContainer, ScrollablePage, Section,
                       BottomActionBar, TopAppBar, FloatingButton, BottomTabs (all mobile-* tags)
      desktop/      ← README only — AppShellComponent/HeaderComponent/FooterComponent/
                       PartnerShellComponent (pre-existing, untouched) already fill this role
      tablet/       ← README only — no dedicated components yet; use BreakpointService
    app-shell/ header/ footer/ auth-*/  *-form/  hero-section/  cta-section/  feature-card/
    metric-card/ partner-shell/ pagination/ table-toolbar/ data-table/ star-rating/
    file-upload/ restaurant-branch-switcher/ cart-badge/ notification-badge/ order-status-badge/
                                                                 ← pre-existing, entirely untouched
```

`@patheya-express-frontend/core` gained one new export this session:
**`BreakpointService`** (`lib/responsive/breakpoint.service.ts`) — a signals-based
`isMobile()`/`isTablet()`/`isDesktop()` reactive viewport tier, the "use responsive techniques
instead of duplicate components" primitive the brief asked for. It sits in `core` (next to
`MobilePlatformService`) rather than `ui` because — see the note below — `ui` is a *buildable*
ng-packagr library that cannot depend on `core` directly; `BreakpointService` has no such
constraint since nothing inside `ui` needs to import it (only apps do).

**Why `NetworkStatusService` stayed in `shared-ui` instead of moving to `shared-core`**: it was
moved there mid-refactor and reverted after `nx build ui` failed. `core` has no `build` target (an
Nx "source-only" library, always compiled as part of a consuming app); `ui` does (`ng-packagr`,
compiled in isolation). A source-only library can freely import from anywhere because it's never
built standalone — but a buildable library importing from a source-only sibling breaks its
isolated build (`Cannot find module '@patheya-express-frontend/core'`). `MobilePlatformService`
never hit this because nothing in `ui` imports it; `OfflineBannerComponent`/`NetworkStatusComponent`
*do* need `NetworkStatusService`, so it had to stay inside the buildable library that uses it.

## 8. Remaining platform-specific infrastructure

Per the brief's instruction that platform differences should live in layout/navigation/services,
not duplicate components:

- **Layouts** — `layouts/mobile/`, `layouts/desktop/` (existing components), `layouts/tablet/`
  (documented fallback) — see §7's tree and the two README files.
- **Navigation** — Desktop: `HeaderComponent`/`AppShellComponent` (existing). Side: 
  `PartnerShellComponent` (existing, restaurant-app/delivery-app's web nav). Bottom:
  `BottomTabsComponent` (new, `layouts/mobile/`). Top (mobile): `TopAppBarComponent` (new,
  `layouts/mobile/`).
- **Native integrations** — untouched, still isolated in `@patheya-express-frontend/core`'s
  `lib/mobile/` (`MobilePlatformService`, `provideMobilePlatform()` — StatusBar/SplashScreen/
  Keyboard/hardware back button) from Phase 1. Push notifications and deep links were never
  implemented in either library (flagged as future work in Phase 1's docs) — still not part of
  this workspace.
- **Responsive technique** — `BreakpointService` (`core`) + this library's design tokens
  (`--touch-target-*`, container-query-ready spacing scale) are the mechanism for "one component,
  many viewports" instead of per-platform component forks.
- **Cards stay out of `shared-ui`'s domain**: `RestaurantCardComponent`/`OrderCardComponent`/
  `AddressCardComponent`/`DeliveryCardComponent` here take plain view-models
  (`types/view-models.types.ts`), not real entities — `libs/features/restaurant-discovery`,
  `restaurant-orders`, `addresses`, `delivery-assignments`'s own domain-bound cards were **not
  touched** (explicitly out of scope: "Do not change feature libraries") and keep serving those
  apps' current web screens exactly as before.

## 9. Build verification

- `nx build ui` — clean.
- `nx lint ui` — clean (0 errors).
- `nx lint core` — clean.
- `nx run-many --target=build --projects=customer-app,restaurant-app,delivery-app,admin-app
  --configuration=development` — all 4 succeed.
- `nx run-many --target=build --projects=customer-app,restaurant-app,delivery-app,admin-app
  --configuration=production` — all 4 succeed. All four print a pre-existing "initial bundle
  exceeded 500kB budget" *warning* (not an error — the configured error threshold is 1MB) —
  confirmed pre-existing and unrelated to this refactor: the same production build also warns on
  individual `.component.scss` budget overages in `restaurant-holidays`, `restaurant-onboarding`,
  `admin-orders`, `admin-notifications` and `admin-support` — five feature libraries this
  refactor never touched.
- `nx run-many --target=lint --all` (58 projects) — clean. (Found and fixed one unrelated
  pre-existing gap along the way: `apps/*/android`/`apps/*/ios` — Capacitor's copied native-shell
  web assets from Phase 1 — weren't excluded from the root ESLint config's `ignores`, so linting
  "everything" tried to lint minified JS bundles. Added `**/android`/`**/ios` to the root
  `eslint.config.mjs` ignore list.)
