/**
 * Every state {@link PlaycanvasRuntime} can report through {@link PlaycanvasRuntime.getStatus}.
 * `'paused'` covers both "created but never started" and "was running, now suspended" — callers
 * that need to tell the two apart track it themselves; the runtime doesn't need the distinction
 * internally beyond deciding whether `resume()` should call the engine's one-time `start()` or its
 * repeatable resume primitive (see {@link PlaycanvasRuntime.resume}'s doc comment).
 */
export type RuntimeState = 'idle' | 'initializing' | 'running' | 'paused' | 'error' | 'destroyed';

export interface RuntimeStatus {
  readonly state: RuntimeState;
  /** Present only when `state` is `'error'` — human-readable, not for programmatic branching. */
  readonly message?: string;
}

/**
 * Phase 1 has no adaptive/FPS-driven selection logic (see the architecture validation, §19/§16) —
 * this type exists only so `ExperienceConfig` and future quality-tier work have a stable name to
 * agree on now, before any tier actually changes rendering behavior.
 */
export type QualityTier = 'high' | 'medium' | 'low' | 'off';

/** What kind of content an {@link ExperienceAssetReference} points at. Phase 2.1 defines only the
 *  shape — no loader exists yet for any of these (see that type's own doc comment). */
export type ExperienceAssetType = 'model' | 'texture' | 'environment' | 'animation' | 'audio' | 'thumbnail';

/**
 * A plain reference to a piece of content an experience implementation may want to load — GLB/GLTF
 * models, textures, environment maps, animation clips, audio, or a poster/thumbnail. Phase 2.1
 * defines only this shape (the architecture validation's asset-strategy section, and Phase 2.1's
 * own §2/§7): no loader, cache, retry, or progress reporting exists yet — that's explicitly
 * Phase 2.2. `url` is whatever a caller already resolved (e.g. via the existing `MediaUrlService`)
 * before it ever reaches this contract; this library has no opinion on same-origin vs. CDN hosting.
 */
export interface ExperienceAssetReference {
  readonly id: string;
  readonly type: ExperienceAssetType;
  readonly url: string;
}

/**
 * The ONLY thing allowed to cross the Angular → runtime boundary (architecture validation, §15/§6
 * of the Phase 1 brief) — plain data, no Angular services, no RxJS, no PlayCanvas objects, and (as
 * of Phase 2.1) no business-domain models (no Product/Restaurant/Order/Cart references of any
 * kind — see the Phase 2.1 brief §1's explicit prohibition).
 */
export interface ExperienceConfig {
  /**
   * Distinct instance identity — e.g. a specific product's or restaurant's experience — as
   * opposed to {@link experienceType}, which identifies the *template*. Not read by anything in
   * Phase 2.1 (the one technical-demo experience has no per-instance state to key on); declared
   * now so a future per-entity experience has a natural place for its own identity without a
   * breaking change to this interface later.
   */
  readonly id?: string;
  /**
   * Which registered experience implementation to resolve and construct — see
   * `ExperienceRegistry.resolve`. Phase 2.1 ships exactly one:
   * `TECHNICAL_DEMO_EXPERIENCE_TYPE` ('technical-demo'). Renamed from Phase 1's `sceneId` now
   * that this selects a business-agnostic experience implementation, not literally a "scene".
   */
  readonly experienceType: string;
  readonly quality: QualityTier;
  /** Plain boolean, not a signal — the UI adapter reads the existing reduced-motion signal (see
   *  `libs/shared/ui/src/lib/animations/reduced-motion.util.ts`) and passes its current value in,
   *  rather than the runtime ever depending on Angular/the signal itself. */
  readonly reducedMotion: boolean;
  /** Optional — Phase 2.1's one experience needs none. See {@link ExperienceAssetReference}. */
  readonly assets?: readonly ExperienceAssetReference[];
  /**
   * Arbitrary experience-specific configuration that a given implementation defines and narrows
   * for itself — deliberately `unknown`, never `any` (Phase 2.1 brief §1's explicit instruction):
   * nothing outside one specific experience factory may assume anything about this shape without
   * validating it first.
   */
  readonly settings?: Readonly<Record<string, unknown>>;
}
