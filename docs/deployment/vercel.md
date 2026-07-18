# Vercel deployment

Vercel hosting for the four Angular apps, as the QA-tier frontend counterpart to
`patheya-express-platform`'s `docs/deployment/render.md` (backend) and `qa-environment.md`. This
document covers only the Vercel-side configuration — **it does not include GitHub Actions/CI
wiring**, which is a separate, later piece of work.

## Architecture

**One Vercel project per Angular app**, all four pointed at the same Nx monorepo (this repo), each
with its own Build Command / Output Directory. Vercel's Root Directory setting stays the
repository root for all four projects — Nx needs the full workspace (`node_modules`, `libs/*`, the
shared `nx.json`/`tsconfig.base.json`) to resolve any single app's build, so pointing Root
Directory at an individual `apps/<app>` folder would break dependency resolution.

```
patheya-express-frontend (this repo)
 ├─ Vercel project: patheya-customer-qa    → nx build customer-app   --configuration=qa
 ├─ Vercel project: patheya-restaurant-qa  → nx build restaurant-app --configuration=qa
 ├─ Vercel project: patheya-delivery-qa    → nx build delivery-app   --configuration=qa
 └─ Vercel project: patheya-admin-qa       → nx build admin-app      --configuration=qa
```

Each deployed app is a pure static SPA (no server-side rendering, no service worker, no
prerendering — see Review below) talking directly to the Render-hosted backend over
`apiBaseUrl`/`socketUrl`/`mediaBaseUrl`, exactly like the nginx-served Docker/Kubernetes
deployment does today. Vercel's own global CDN replaces nginx purely as a static file host; nothing
about how the apps call the backend changes.

## Review findings (no code changes required beyond one shared config file)

| Item | Finding |
|---|---|
| Nx project configuration | All four apps use the identical `@angular/build:application` executor/target shape (`build`, `serve`, `lint`, `serve-static`) — confirmed structurally identical across `customer-app`/`admin-app`/`delivery-app`/`restaurant-app`. |
| Angular build outputs | Pure static output: `dist/apps/<app>/browser/` contains only hashed JS/CSS chunks, `index.html`, and copied `public/` assets (confirmed by inspecting real build output this phase — `favicon.ico` + `index.html` are the only two non-JS/CSS files). A `dist/apps/<app>/prerendered-routes.json` file is also emitted with an empty `"routes": {}` — this is the Angular application builder's own artifact and does **not** indicate SSR/prerendering is active; it lives outside `browser/` and Vercel never needs to serve it. |
| Routing | Every app uses `provideRouter(routes)` (`app.config.ts`) — standard `PathLocationStrategy`, no hash routing. This means every deep link (e.g. `/restaurants/:id`, `/checkout`, `/orders/:id`) is a real browser URL with nothing on the server to match it — a hard refresh or direct navigation to any of these needs a rewrite to `index.html`, exactly like nginx's existing `try_files $uri $uri/ /index.html` already provides for the Docker deployment. |
| Assets | `public/` (per app, currently just `favicon.ico`) is copied into `browser/` unchanged by the existing `assets` glob in each `project.json` — no Vercel-specific handling needed. |
| Environment replacement | Purely build-time via Angular `fileReplacements` (`environment.ts` → `environment.qa.ts` under the `qa` configuration, added in Phase DEV-2) — confirmed baked into the compiled bundle this phase (`grep`-confirmed the QA placeholder origin literally appears in each app's built `main-*.js`). No runtime config-injection mechanism exists (by design, unchanged from Phase DEV-1's finding) — Vercel serves whatever origin was baked in at build time, same as the Docker/nginx path. |
| Generated API SDK | `ApiConfiguration.rootUrl = environment.apiBaseUrl` (`app.config.ts`, all four apps) — a plain string assignment, no origin-detection or `window.location`-based logic. Resolves correctly under Vercel with no change. |
| Service Worker | **Not present** — no `@angular/service-worker` usage, no `ngsw-config.json`, confirmed by a repo-wide search (only an unrelated match in `pnpm-lock.yaml`). Nothing to configure or disable for Vercel. |

**Conclusion: no Angular application code changes were required for Vercel compatibility.** The
only gap was the SPA-refresh rewrite, which nginx already handles for the Docker path but has no
equivalent for Vercel until configured explicitly (see below).

## SPA routing — Vercel configuration added

`vercel.json` (new, repo root):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This is the **minimum** required change — a single catch-all rewrite to `index.html`, mirroring
nginx's existing `try_files $uri $uri/ /index.html` behavior exactly (Vercel, like nginx, only
applies a rewrite when no static file already matches the requested path, so hashed JS/CSS/font
assets and `favicon.ico` are still served directly, not rewritten). Because all four Vercel
projects share this same repository root as their Root Directory, one file at the repo root is
read by all four projects — there was no need for four duplicate copies with identical content.

**This does not affect the nginx/Docker deployment path at all** — `vercel.json` is inert outside
of a Vercel build; nginx's own `app.conf.template` SPA fallback is untouched.

Build Command and Output Directory are deliberately **not** set inside `vercel.json` — they differ
per app (`customer-app` vs. `restaurant-app` vs. …) and setting them in the one shared config file
would break the other three projects. These belong in each Vercel project's own dashboard settings
instead (see below).

## Build

Verified for real this phase — `npx nx build <app> --configuration=qa` for all four apps:

| App | Result |
|---|---|
| `customer-app` | ✅ Build succeeded |
| `admin-app` | ✅ Build succeeded |
| `delivery-app` | ✅ Build succeeded |
| `restaurant-app` | ✅ Build succeeded |

(Nx's cache reported these as already-current from the identical build run in Phase DEV-2's
validation — re-verified rather than re-executed from scratch, since nothing in `apps/*/src` or
`project.json`'s `qa` configuration changed between phases.)

## Output directory

Confirmed by inspecting the actual build output (not assumed): **`dist/apps/<app-name>/browser`**
for every app — this is the directory Vercel's "Output Directory" project setting must point at,
not `dist/apps/<app-name>` (which also contains `3rdpartylicenses.txt` and
`prerendered-routes.json`, neither of which should be served).

## API, Socket, and Media URL resolution

Confirmed via `environment.qa.ts` (all four apps) and the shared `MediaUrlService`
(`libs/shared/core/src/lib/media-url/media-url.service.ts:24`,
`` `${this.environment.mediaBaseUrl}${path}` ``):

- `apiBaseUrl` → `ApiConfiguration.rootUrl` (generated SDK) — resolves to the QA backend origin.
- `socketUrl` → `RealtimeSocketService`'s `io(this.environment.socketUrl, ...)` — resolves to the
  same QA backend origin (Socket.IO and REST share one origin, per the existing pattern).
- `mediaBaseUrl` → `MediaUrlService`, prefixed onto relative media paths returned by the backend.

All three currently resolve to the same placeholder
(`https://replace-with-qa-backend-url`, one shared origin per Phase DEV-2's `environment.qa.ts`) —
replace this with the real Render Web Service URL once it exists. No frontend code change is
needed to do that; it's a one-line edit per app's `environment.qa.ts` followed by a rebuild.

## Performance — review only, no changes made

Current state (unchanged this phase):

- Bundle budgets are configured per app in the `production` build configuration only (e.g.
  `admin-app`: 500kb initial warning / 1mb error, 4kb/8kb per-component-style) — the `qa`
  configuration inherits no budget enforcement of its own (it only overrides `fileReplacements`
  and `outputHashing`), so a QA build can silently exceed what `production` would flag.
- `outputHashing: "all"` is already set for both `staging` and `qa` configurations — Vercel (like
  nginx) can safely apply long-lived caching to every hashed JS/CSS/font file.
- No compression, HTTP/2 push, or edge-caching configuration exists in `vercel.json` — Vercel's
  platform-level compression (brotli/gzip) applies automatically regardless, so this is not a gap,
  just something not explicitly configured either way.

**Future recommendations (not implemented — out of scope for a review-only pass):**
1. Add an explicit `qa` (and `staging`) budget block to each app's `project.json`, rather than only
   `production`, so a regression is caught before it reaches `production`'s stricter gate.
2. Consider adding a `headers` rule to `vercel.json` for immutable long-term caching on hashed
   assets (`Cache-Control: public, max-age=31536000, immutable`) — nginx's `app.conf.template`
   already does this for the Docker path; Vercel's default caching is not guaranteed to match it
   exactly without an explicit rule.
3. Once a real QA backend origin exists, measure actual Core Web Vitals against it (Vercel Speed
   Insights or an equivalent) — no such data exists yet since no QA backend has been provisioned.

## QA deployment flow

1. Create four Vercel projects from this repository, one per app.
2. For each project, set (via the Vercel dashboard, not `vercel.json`):
   - **Root Directory**: repository root (leave default).
   - **Build Command**: `npx nx build <app> --configuration=qa` (e.g. `npx nx build customer-app --configuration=qa`).
   - **Output Directory**: `dist/apps/<app>/browser`.
   - **Install Command**: leave at Vercel's auto-detected `pnpm install` (this is a pnpm workspace;
     Vercel detects `pnpm-lock.yaml` automatically).
3. Before the first deploy of any app, update that app's `environment.qa.ts` `apiBaseUrl`/
   `socketUrl`/`mediaBaseUrl` from the placeholder to the real Render QA backend URL (see
   `patheya-express-platform/docs/deployment/render.md`), commit, then trigger the build.
4. Confirm the deployed app's SPA rewrite works by navigating directly to a deep route (e.g.
   `/restaurants/some-id`) and hard-refreshing — this is the one behavior that would silently break
   without `vercel.json`.
5. Repeat for the remaining three apps.

## Vercel limitations found during this review

- Vercel Background/cron-style workers don't apply here (frontend is purely static) — nothing
  analogous to the backend's Web Service / Background Worker split is needed on this side.
- Because all four projects share one repository root and one `vercel.json`, any *future* app-
  specific Vercel configuration (custom headers, redirects unique to one app) can't live in the
  shared file without affecting the other three — it would need per-project environment variables
  read by a build script, or splitting into per-app config at that point. Not a problem today since
  the only current requirement (the SPA rewrite) is identical across all four.
- No live Vercel deployment was performed in this review (no Vercel account/project exists in this
  session) — everything above is verified by real local builds and code inspection, not a live
  Vercel build. This is stated explicitly rather than implied.
