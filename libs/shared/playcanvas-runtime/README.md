# @patheya-express-frontend/playcanvas-runtime + playcanvas-ui

The Patheya Interactive Commerce Engine foundation — a reusable, domain-agnostic PlayCanvas
rendering capability. **Not** a food/product/restaurant/delivery 3D feature; nothing here knows
about any Patheya business domain. See the architecture validation report for the full rationale
behind Phase 1; this file documents what actually shipped (Phase 1 + Phase 2.1) and the rules
future work must keep.

## What each library is

- **`playcanvas-runtime`** (`type:core`, `scope:shared`) — plain TypeScript, zero Angular
  dependency. The *only* place `playcanvas` is imported (via `import('playcanvas')` inside
  `create()`, never at module top level). Owns one `pc.Application` instance's entire lifecycle:
  device creation (WebGPU-with-WebGL2-fallback), the render/update loop, resize, pause/resume,
  `devicelost`/`devicerestored` recovery, and disposal. As of Phase 2.1, it does **not** own scene
  *content* itself — that's built by whichever `Experience` the configured `experienceType`
  resolves to (see below).
- **`playcanvas-ui`** (`type:ui`, `scope:shared`) — the Angular adapter. `PlaycanvasSceneComponent`
  hosts the `<canvas>`, wires a `ResizeObserver`/`IntersectionObserver` and
  `MobilePlatformService`'s native pause/resume into a `PlaycanvasRuntime` instance, and runs all of
  it via `NgZone.runOutsideAngular` (this app is zone.js-based with `OnPush` everywhere — an
  unmanaged PlayCanvas render loop inside Angular's zone would trigger full-tree change detection
  every frame).

## What an Interactive Experience is

An **Experience** is the unit of pluggable, business-agnostic scene content — "product showcase,"
"restaurant exploration," a future business domain's own concept — identified by a plain string
(`ExperienceConfig.experienceType`) and constructed by an `ExperienceFactory` registered on an
`ExperienceRegistry`. Phase 2.1 ships exactly one: `TECHNICAL_DEMO_EXPERIENCE_TYPE`
(`'technical-demo'`) — one camera, one light, one rotating box, still not a product feature, now
just *built* through the generic mechanism instead of hardcoded inside the runtime.

```
Business domain (future — not built yet)
        │  e.g. a product/restaurant entity's own data
        ▼
Experience configuration            ← ExperienceConfig: plain data (experienceType, quality,
        │                              reducedMotion, assets, settings) — no Angular, no RxJS,
        │                              no PlayCanvas objects, no Product/Restaurant/Order/Cart
        ▼
Experience registry                 ← ExperienceRegistry: resolves experienceType → factory
        │                              (explicit .register(), throws on unknown type)
        ▼
Experience implementation           ← ExperienceFactory → Experience: builds/owns scene content
        │                              under its own scoped root entity; only dispose() required
        ▼
Playcanvas runtime                  ← PlaycanvasRuntime: owns the Application/device — creates the
        │                              experience's root entity, resolves + constructs it, forwards
        │                              start/pause/resume/resize/destroy as optional content hooks
        ▼
PlayCanvas
```

### Runtime vs. Experience vs. Angular UI — who owns what

| Layer | Owns | Never |
|---|---|---|
| `PlaycanvasRuntime` | The `Application`, the `GraphicsDevice`, the render/update loop, resize, pause/resume, context-loss recovery, disposal of everything | Knows what any experience actually renders, or any business domain |
| `Experience` (via `ExperienceFactory`) | Its own entities/materials/content under the `root` entity it's given; optional reactions to `start`/`pause`/`resume`/`resize`; required `dispose()` for anything beyond that entity subtree | Application/device-level control — no `start()`/`destroy()` on the device, no direct WebGL/graphics-device access |
| `PlaycanvasSceneComponent` (Angular) | The `<canvas>` host element, Angular's own lifecycle hooks, the browser observers, translating `MobilePlatformService`/reduced-motion into plain config | Any PlayCanvas object, any experience-specific logic — it passes `ExperienceConfig` through unchanged and never inspects what a given `experienceType` does |

This is a deliberately different lifecycle from the runtime's own (Phase 2.1 brief §4): the
runtime's `start`/`pause`/`resume`/`resize`/`destroy` control the GPU device itself; an
`Experience`'s same-named optional hooks let *content* react to those transitions (e.g. pausing a
tween) without ever being able to trigger them.

## Asset contract

`ExperienceConfig.assets?: readonly ExperienceAssetReference[]` — a plain `{ id, type, url }` per
asset (`type` is `'model' | 'texture' | 'environment' | 'animation' | 'audio' | 'thumbnail'`).
Phase 2.1 defines only this shape. There is no loader, no cache, no retry, no progress reporting,
no backend upload path, and no CDN infrastructure — an experience factory that needs assets would
today have to load them itself; a shared loading/caching abstraction is explicitly Phase 2.2.

## Registry

`ExperienceRegistry` is a plain, instantiable class — `register(type, factory, { allowOverride? })`
/ `resolve(type)` (throws a clear error for an unknown type) / `has(type)`. Deliberately **not** a
global singleton: `PlaycanvasRuntimeOptions.experienceRegistry` is optional, and when omitted each
`PlaycanvasRuntime` builds its own private default registry (`createDefaultExperienceRegistry()`,
technical-demo only) — never a shared object multiple unrelated runtimes could mutate. Registering
the same `experienceType` twice throws by default (a real bug worth failing loudly on), not a
silent overwrite.

## How a future business domain will plug in (not built yet)

A feature library would: build its own `ExperienceFactory` (a plain function receiving
`{ pc, root, config, onUpdate }`, importing `playcanvas`'s *types* only, never a value-level
import); construct its own `ExperienceRegistry` (optionally seeded via
`createDefaultExperienceRegistry()` and then `.register('product-showcase', myFactory)`); and pass
that registry to `<lib-playcanvas-scene [experienceRegistry]="myRegistry" [config]="myConfig" />`.
Nothing in `playcanvas-runtime` or `playcanvas-ui` needs to change for this — the extension point
is real and tested (see `playcanvas-scene.component.spec.ts`'s registry-forwarding tests), even
though no business experience actually exists yet.

## What is intentionally NOT included yet

- No product/restaurant/grocery/delivery experience implementation — Phase 2.1 is infrastructure
  only (brief §11).
- No asset loader/cache/retry (§2/§7 above) — shape only.
- No adaptive/FPS-driven quality engine, no GPU benchmarking — `QualityTier` is preserved unchanged
  from Phase 1 and still only coarsely affects device antialiasing.
- No ECS, physics, WebXR, editor integration, or scripting DSL — explicitly out of scope (brief §5).
- No experience-swapping-without-full-destroy capability — the experience `root` entity is scoped
  per-experience specifically so this becomes possible later, but nothing today rebuilds a running
  runtime's experience without a full `destroy()`/`create()` cycle.

## Dependency direction — and why both libraries have no `build` target

`playcanvas-ui` depends on `playcanvas-runtime` (permitted: `type:ui` may depend on `type:core`,
the same shape `map-picker` already uses for `APP_ENVIRONMENT`). Neither library declares a
`build` target. This isn't an oversight — see `libs/shared/ui/README.md` §7's own note on exactly
this constraint: `@nx/enforce-module-boundaries`'s `enforceBuildableLibDependency` rule forbids a
*buildable* (ng-packagr) library from depending on a *non-buildable* (source-only) one. `core` has
no `build` target for the same reason. Giving `playcanvas-runtime` one (to let a buildable
`playcanvas-ui` depend on it) would mean either redesigning `core` to match or diverging from it —
out of scope. Non-buildable/non-buildable, matching `core`↔`map-picker`'s actual existing
relationship, needed zero `eslint.config.mjs` changes and is the more conservative fix.

## Rules future work must keep

- **Lazy-loading**: `playcanvas-runtime`/`playcanvas-ui` are only ever reached from a route or
  component behind a dynamic `import()` — never a static import from `app.config.ts`, `main.ts`,
  or any eagerly-loaded file. Verified: the production `customer-app` build isolates all of
  PlayCanvas into its own lazy chunk (confirmed via bundle inspection — zero PlayCanvas symbols in
  any initial chunk), including after Phase 2.1's additions — the registry/experience layer adds no
  new `playcanvas` import site.
- **Domain boundary**: `playcanvas-runtime` must never import `OrderService`/`CartService`/
  `RestaurantService`/any `libs/features/*` — structurally enforced by its own `type:core` tag
  (`onlyDependOnLibsWithTags` excludes `type:feature`). The only thing that crosses from Angular
  into the runtime is `ExperienceConfig` — plain data, never a PlayCanvas object, an Angular
  service, or an RxJS subscription. This now extends to every `Experience`/`ExperienceFactory`
  registered on a registry: none may import a business-domain library either — the registry only
  ever holds a `string → function` map, never anything Nx's own module boundaries wouldn't already
  allow `playcanvas-runtime` to depend on.
- **One `Application` per experience surface**: `PlaycanvasRuntime` is instantiated per
  `PlaycanvasSceneComponent`, never as a singleton/`providedIn: 'root'`. A future grid of many
  simultaneous experiences must keep this — one live instance for whatever's focused, static
  posters for the rest (see the validation report's mobile-performance section for why).
- **Disposal**: `ngOnDestroy` always calls `runtime.destroy()`, which calls the active experience's
  `dispose()` and then PlayCanvas's own `Application.destroy()` — releasing every entity, asset,
  and the WebGL context with it. No `Application`, and no experience's own resources, may outlive
  the component that created it.
