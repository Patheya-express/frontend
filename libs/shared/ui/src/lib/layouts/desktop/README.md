# layouts/desktop

No components physically live here. Desktop/web page chrome is already served by components that
existed in `shared-ui` before this unification and were **not moved**, to avoid the churn/risk of
relocating already-shipped, actively-consumed files for a purely cosmetic reorganization:

- **`AppShellComponent`** (`../../app-shell`) — `customer-app`'s top nav + header + footer shell
  (cart badge, search bar, location picker, notifications).
- **`HeaderComponent`** / **`FooterComponent`** (`../../header`, `../../footer`) — the primitives
  `AppShellComponent` composes.
- **`PartnerShellComponent`** (`../../partner-shell`) — the authenticated-area shell for
  `restaurant-app`/`delivery-app`'s web UI (brand name, nav links, logout) — this is also this
  workspace's existing **Side Navigation** pattern (see `../../../overlays` vs this: desktop
  nav needs no overlay host, it's always-mounted chrome).

These are "desktop navigation" in the sense the unification brief asked to keep platform-specific
— and they already were, before `mobile-ui` ever existed. Nothing about them changed.
