import type * as pcNamespace from 'playcanvas';
import type { ExperienceConfig } from './types';

/**
 * What an experience implementation receives to build its content — deliberately narrower than
 * the full PlayCanvas `Application`: `root` is a dedicated child entity `PlaycanvasRuntime` creates
 * and owns (never `app.root` itself), so an experience can only ever add to/remove from its own
 * subtree, and the runtime can always guarantee full cleanup via `Application.destroy()` even if a
 * given experience's own `dispose()` misses something. Device/`Application`-level control (start,
 * pause, resize, destroy) intentionally stays out of this context — see {@link Experience}'s own
 * doc comment for why; `onUpdate` is the one narrow exception, for content that genuinely needs a
 * per-frame hook (e.g. an animation), without handing over the whole `Application` object just to
 * reach `app.on('update', ...)`.
 */
export interface ExperienceContext {
  readonly pc: typeof pcNamespace;
  readonly root: pcNamespace.Entity;
  readonly config: ExperienceConfig;
  /** Registers a per-frame callback while the runtime's render loop is ticking. No unsubscribe is
   *  provided — every registered callback's lifetime is tied to the `Application` itself, torn
   *  down automatically when `PlaycanvasRuntime.destroy()` calls `Application.destroy()`. */
  onUpdate(callback: (deltaTimeSeconds: number) => void): void;
}

/**
 * The scene/content-level lifecycle a registered experience implementation may participate in.
 * Deliberately NOT the same lifecycle as `PlaycanvasRuntime`'s own `start`/`pause`/`resume`/
 * `resize`/`destroy` (Phase 2.1 brief §4: "do not duplicate PlaycanvasRuntime's device lifecycle")
 * — those own the GPU device/`Application`; these hooks let content *react* to those transitions
 * (e.g. pausing a tween, swapping a texture on resize) without ever controlling the device
 * themselves. Every hook but `dispose` is optional: most experiences need only a fraction of this
 * lifecycle, and forcing every future implementation to declare no-op overrides for stages it
 * doesn't use would be exactly the kind of speculative ceremony this foundation is meant to avoid.
 */
export interface Experience {
  /** Called after the runtime's own `Application.start()` — e.g. to kick off an animation. */
  start?(): void;
  /** Called after the runtime suspends its render loop — e.g. to pause a video texture/tween. */
  pause?(): void;
  /** Called after the runtime resumes its render loop. */
  resume?(): void;
  /** Called after the runtime resizes the canvas/device — e.g. to react to a new aspect ratio. */
  resize?(width: number, height: number): void;
  /**
   * Required, unlike every other hook here: release anything this experience created beyond what
   * simply lives under {@link ExperienceContext.root} — that entity subtree is always destroyed by
   * the runtime regardless (via `Application.destroy()`), as a defense-in-depth backstop, but a
   * well-behaved experience should still use this to release any resource it holds outside the
   * entity tree (e.g. a timer, a subscription to something outside PlayCanvas).
   */
  dispose(): void;
}

/**
 * Constructs an {@link Experience} for one runtime instance. Receives `pc` only as a parameter at
 * invocation time — never a module-top-level import — the same discipline `PlaycanvasRuntime`
 * itself follows, so an experience module can be part of this library's public surface without
 * pulling PlayCanvas into any consumer's bundle just by existing.
 */
export type ExperienceFactory = (context: ExperienceContext) => Experience;
