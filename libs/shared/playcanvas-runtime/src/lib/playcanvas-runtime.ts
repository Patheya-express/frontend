import type * as pcNamespace from 'playcanvas';
import { GlbLoader } from './assets/glb-loader';
import { createDefaultExperienceRegistry } from './default-experience-registry';
import type { Experience } from './experience';
import type { ExperienceRegistry } from './experience-registry';
import type { ExperienceConfig, RuntimeStatus } from './types';

export interface PlaycanvasRuntimeOptions {
  /** Fired on every status transition — the ONLY thing the UI adapter re-enters Angular's zone
   *  for (architecture validation §7/§20; Phase 1 brief §7). Never fired per-frame. */
  readonly onStatusChange?: (status: RuntimeStatus) => void;
  /** Resolves `ExperienceConfig.experienceType` to an implementation. Defaults to a private,
   *  per-instance registry pre-populated with only the Phase 1 technical-demo experience (see
   *  `createDefaultExperienceRegistry`) — never a shared/global registry. Pass a custom one to
   *  register additional experience types (a future business domain plugging in — not built in
   *  Phase 2.1, see this library's README). */
  readonly experienceRegistry?: ExperienceRegistry;
}

/**
 * Framework-independent owner of one PlayCanvas `Application` instance and everything tied to its
 * GPU resources. Has no Angular import anywhere in this file or its dependencies (`experience.ts`,
 * `experience-registry.ts`, `types.ts`, `assets/glb-loader.ts`) — the `pc` module is loaded via
 * `import('playcanvas')` inside `create()`, never at this file's top level, so nothing reachable
 * from this library statically pulls PlayCanvas into a consumer's bundle (Phase 1 brief §22/§23).
 *
 * One instance = one live experience surface (architecture validation §19/§29, Phase 1 brief §31)
 * — never a shared singleton. The Angular adapter owns exactly one of these per
 * `PlaycanvasSceneComponent` and destroys it in `ngOnDestroy`. As of Phase 2.1, this class owns
 * only the `Application`/device lifecycle — the actual scene content is built and owned by
 * whichever `Experience` the configured `experienceType` resolves to (see `experience.ts`); this
 * class never contains business logic or knows what any given experience actually renders.
 */
export class PlaycanvasRuntime {
  private pc: typeof pcNamespace | null = null;
  private app: pcNamespace.AppBase | null = null;
  private deviceLostHandle: pcNamespace.EventHandle | null = null;
  private deviceRestoredHandle: pcNamespace.EventHandle | null = null;
  private glbLoader: GlbLoader | null = null;
  private experience: Experience | null = null;
  private readonly experienceRegistry: ExperienceRegistry;
  private status: RuntimeStatus = { state: 'idle' };
  /** Distinguishes "never started" from "paused" — see {@link resume}'s doc comment for why. */
  private hasStarted = false;
  private destroyRequested = false;

  constructor(private readonly options: PlaycanvasRuntimeOptions = {}) {
    this.experienceRegistry = options.experienceRegistry ?? createDefaultExperienceRegistry();
  }

  getStatus(): RuntimeStatus {
    return this.status;
  }

  /**
   * Creates the graphics device and `Application` against `canvas`, then resolves
   * `config.experienceType` through this instance's {@link ExperienceRegistry} and constructs it.
   * Does NOT start the render loop — callers decide when rendering should actually begin (e.g.
   * only once an `IntersectionObserver` confirms the canvas is visible), via {@link start}.
   *
   * Requests WebGPU with an explicit WebGL2 fallback (architecture validation §7): PlayCanvas's
   * own `createGraphicsDevice` appends `DEVICETYPE_WEBGL2` automatically if it's omitted, but this
   * lists both explicitly so the WebGL2 floor is an intentional, auditable choice rather than an
   * implicit default — see the Phase 1 brief §12's instruction not to assume WebGPU availability.
   */
  async create(canvas: HTMLCanvasElement, config: ExperienceConfig): Promise<void> {
    if (this.status.state !== 'idle') {
      throw new Error(`PlaycanvasRuntime.create() called while status was "${this.status.state}" — a runtime instance may only be created once.`);
    }

    this.setStatus({ state: 'initializing' });

    try {
      const pc = await import('playcanvas');
      if (this.destroyRequested) {
        return;
      }

      const device = await pc.createGraphicsDevice(canvas, {
        deviceTypes: [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
        antialias: config.quality === 'high' || config.quality === 'medium',
      });

      if (this.destroyRequested) {
        device.destroy();
        return;
      }

      const app = new pc.Application(canvas, { graphicsDevice: device });

      this.pc = pc;
      this.app = app;
      this.deviceLostHandle = app.graphicsDevice.on('devicelost', () => this.handleDeviceLost());
      this.deviceRestoredHandle = app.graphicsDevice.on('devicerestored', () => this.handleDeviceRestored());

      // Content lives under its own child entity, never directly on `app.root` — so an experience
      // can only ever touch its own subtree, and a future capability could swap the active
      // experience by destroying/rebuilding just this entity, without tearing down the whole
      // Application (not built in Phase 2.1 — see this library's README).
      const experienceRoot = new pc.Entity('experience-root');
      app.root.addChild(experienceRoot);

      const glbLoader = new GlbLoader(app.assets);
      this.glbLoader = glbLoader;

      const factory = this.experienceRegistry.resolve(config.experienceType);
      this.experience = factory({
        pc,
        root: experienceRoot,
        canvas,
        config,
        onUpdate: (callback) => app.on('update', callback),
        loadModel: (reference) => glbLoader.load(reference),
      });

      this.setStatus({ state: 'paused' });
    } catch (error) {
      this.setStatus({ state: 'error', message: describeError(error) });
    }
  }

  /** One-time bootstrap — runs PlayCanvas's own `initialize`/`postinitialize` lifecycle and begins
   *  ticking. A no-op (not an error) if called again, or if `create()` hasn't succeeded. */
  start(): void {
    if (!this.app || this.status.state === 'error' || this.status.state === 'destroyed') {
      return;
    }

    if (!this.hasStarted) {
      this.app.start();
      this.hasStarted = true;
    }

    this.experience?.start?.();
    this.setStatus({ state: 'running' });
  }

  /**
   * Suspends the render/update loop without tearing down the `Application`, its entities, or its
   * GPU-resident assets (architecture validation §10/§20) — for the canvas leaving the viewport or
   * the app backgrounding, never for component destruction (use {@link destroy} for that).
   *
   * Uses `AppBase.cancelTick`, which cancels the pending `requestAnimationFrame` request — the
   * lowest-level pause primitive PlayCanvas exposes, verified against the installed engine's own
   * type declarations rather than assumed.
   */
  pause(): void {
    if (!this.pc || !this.app || this.status.state !== 'running') {
      return;
    }

    this.pc.AppBase.cancelTick(this.app);
    this.experience?.pause?.();
    this.setStatus({ state: 'paused' });
  }

  /**
   * Resumes ticking after {@link pause}. If the app was never actually started yet, delegates to
   * {@link start} instead — `app.requestAnimationFrame()` only reschedules an already-running tick
   * loop, it does not perform PlayCanvas's one-time `initialize`/`postinitialize` bootstrap.
   */
  resume(): void {
    if (!this.app || this.status.state !== 'paused') {
      return;
    }

    if (!this.hasStarted) {
      this.start();
      return;
    }

    this.app.requestAnimationFrame();
    this.experience?.resume?.();
    this.setStatus({ state: 'running' });
  }

  resize(width: number, height: number): void {
    this.app?.resizeCanvas(width, height);
    this.experience?.resize?.(width, height);
  }

  /**
   * Tears down everything this instance created: the `Application` (which per PlayCanvas's own
   * `destroy()` releases every entity, asset, and the graphics device/WebGL context with it) and
   * the `devicelost`/`devicerestored` listeners. Idempotent and safe to call from any state,
   * including mid-`create()` — {@link create} checks `destroyRequested` at both of its `await`
   * points so an in-flight creation cleans itself up instead of leaving an orphaned `Application`
   * that outlives the Angular component that requested it (architecture validation §20, Phase 1
   * brief §15).
   */
  destroy(): void {
    this.destroyRequested = true;

    if (this.status.state === 'destroyed') {
      return;
    }

    this.experience?.dispose();
    this.experience = null;

    // Marks any loadModel() call still in flight to discard its result once PlayCanvas's callback
    // eventually fires, rather than resolving it after this instance has already torn down — see
    // GlbLoader.dispose()'s own doc comment.
    this.glbLoader?.dispose();
    this.glbLoader = null;

    this.deviceLostHandle?.off();
    this.deviceRestoredHandle?.off();
    this.deviceLostHandle = null;
    this.deviceRestoredHandle = null;

    // Application.destroy() cascades through the entity hierarchy it owns — including the
    // experience's own `root` entity — so no separate explicit teardown of that entity is needed
    // here beyond the experience's own dispose() above (see Experience's doc comment).
    this.app?.destroy();
    this.app = null;
    this.pc = null;

    this.setStatus({ state: 'destroyed' });
  }

  private handleDeviceLost(): void {
    if (this.status.state === 'running') {
      this.pause();
    }
  }

  private handleDeviceRestored(): void {
    if (this.status.state === 'paused' && this.hasStarted && !this.destroyRequested) {
      this.resume();
    }
  }

  private setStatus(status: RuntimeStatus): void {
    this.status = status;
    this.options.onStatusChange?.(status);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
