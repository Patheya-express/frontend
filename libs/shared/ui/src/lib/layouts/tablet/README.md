# layouts/tablet

No dedicated tablet-only components exist yet — none did in `shared-ui` or `mobile-ui` before this
unification either. Tablet-sized viewports currently fall back to whichever of
`layouts/desktop`/`layouts/mobile` a screen already uses, with `BreakpointService`
(`@patheya-express-frontend/core`) available to branch presentation at the `tablet` tier
(768–1023px) when a screen actually needs tablet-specific treatment — e.g.
`breakpointService.isTablet()` to show `layouts/mobile`'s `BottomTabsComponent` alongside a wider,
desktop-style content column, rather than duplicating either shell.

This folder exists (per the requested `layouts/mobile/tablet/desktop` structure) as the place a
real tablet-specific component would go if/when one is needed — not as a claim that one exists
today.
