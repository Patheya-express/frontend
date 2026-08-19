import type * as pcNamespace from 'playcanvas';
import type { Experience, ExperienceContext, ExperienceFactory } from '../experience';

/** Phase 2.4's one registered experience type — see `createDefaultExperienceRegistry`. */
export const REALISTIC_SHOWCASE_EXPERIENCE_TYPE = 'realistic-showcase';

/**
 * Patheya's black/red/green visual language (Phase 2.4 brief §7), sourced from the existing
 * design-token values in `libs/shared/ui/src/theme.scss`'s `dark-palette` mixin
 * (`--color-background`, `--color-error`, `--color-success`) rather than a new color system —
 * copied as plain hex literals instead of read live via `getComputedStyle` because this
 * experience's environment is meant to always be dark (black background, per §7), independent of
 * whichever theme the host page itself is currently in; the *light* values those same tokens
 * resolve to on an un-opted-in page (`--color-background: #f7f7f8`, not black) are exactly the
 * wrong ones for this purpose. This file still never imports `libs/shared/ui` itself (this library
 * stays framework/CSS-agnostic — see its README); `config.settings.colors` remains the override
 * hook if a future caller ever needs different values.
 */
const DEFAULT_COLORS = {
  background: '#121214',
  highlight: '#ff5c4d',
  active: '#38c793',
} as const;

interface RealisticShowcaseColors {
  readonly background: string;
  readonly highlight: string;
  readonly active: string;
}

interface RealisticShowcaseSettings {
  readonly colors?: Partial<RealisticShowcaseColors>;
  /** Gates the dev-only performance instrumentation (Phase 2.4 brief §9) — off by default so a
   *  production build never logs per-second FPS samples; the internal POC page turns it on. */
  readonly debug?: boolean;
}

function resolveColors(settings: unknown): RealisticShowcaseColors {
  const provided = (settings as { colors?: Partial<RealisticShowcaseColors> } | undefined)?.colors;
  return {
    background: provided?.background ?? DEFAULT_COLORS.background,
    highlight: provided?.highlight ?? DEFAULT_COLORS.highlight,
    active: provided?.active ?? DEFAULT_COLORS.active,
  };
}

const DEG_TO_RAD = Math.PI / 180;

/** Clamps `value` into `[min, max]` — used throughout for the hard interaction limits Phase 2.4
 *  §4 requires (no upside-down flip, min/max zoom, camera never enters the model). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface OrbitState {
  /** Degrees, unbounded (wraps freely — there is no "back of the model" restriction). */
  yaw: number;
  /** Degrees, clamped to `pitchRange` — kept strictly inside ±90° so the camera can never look
   *  straight up/down into a gimbal flip, satisfying "no upside-down flip" structurally rather
   *  than by special-casing the flip condition after the fact. */
  pitch: number;
  distance: number;
}

/**
 * A from-scratch, minimal orbit-camera controller built directly on the Pointer Events / Wheel
 * Event web platform APIs (both natively supported in Chromium-based Android WebView — the same
 * runtime every prior phase's Android validation ran against), rather than PlayCanvas's own
 * `OrbitController`/`InputSource`/`KeyboardMouseSource` classes.
 *
 * Those classes were inspected first, per the Phase 2.4 brief §4's explicit instruction to check
 * PlayCanvas's own APIs before reaching for anything third-party (`node_modules/playcanvas/build/
 * playcanvas.d.ts`, `OrbitController extends InputController`, alongside `KeyboardMouseSource`,
 * `DualGestureSource`, `MultiTouchSource`, `Pose`, `InputFrame` — all real, all exported). They
 * were NOT used, for one concrete reason: every one of them is tagged `@alpha` in the installed
 * 2.21.4 build — PlayCanvas's own docs convention for "the shape of this API may still change."
 * This is a customer-facing Capacitor app, not a PlayCanvas editor project; pinning interaction
 * code load-bearing for the product to an alpha upstream surface is a real, avoidable risk this
 * validation phase shouldn't take on. Native `PointerEvent`/`WheelEvent` are stable web platform
 * APIs, not a third-party library — they satisfy the brief's actual concern (external/unstable
 * dependency risk) while still giving this controller the exact, disposal-safe, fully-owned
 * lifecycle Phase 2.4 §5/§10 require. This is a documented engineering trade-off, not a rewrite of
 * anything existing — see the Phase 2.4 report's "Camera Interaction" section for the full
 * reasoning.
 *
 * One instance owns exactly the DOM listeners it attaches in its constructor and removes in
 * `dispose()` — never a `window`-level listener, only the `canvas` element passed in.
 */
class OrbitCameraController {
  private readonly state: OrbitState;
  private minDistance = 0.1;
  private maxDistance = 100;
  private readonly pitchRange: readonly [number, number] = [-85, 85];
  private readonly rotateSpeed = 0.25; // degrees per pixel of pointer movement
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance: number | null = null;
  private pinchStartCameraDistance: number | null = null;
  private disposed = false;

  /** Fires whenever the user starts/stops actively dragging — the realistic-showcase experience
   *  uses this to drive the red(idle)/green(active) indicator disc (Phase 2.4 brief §7). */
  onInteractionChange: ((active: boolean) => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    initialYaw: number,
    initialPitch: number,
    initialDistance: number,
  ) {
    this.state = { yaw: initialYaw, pitch: clamp(initialPitch, this.pitchRange[0], this.pitchRange[1]), distance: initialDistance };

    // Pointer Events unify mouse + touch on one code path (desktop drag, one-finger mobile drag);
    // a second active pointer is what turns the same `pointermove` handler into a pinch gesture —
    // no separate touch-specific listener type is needed.
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    // Non-passive: zooming the 3D scene must suppress the page's own scroll-on-wheel behavior.
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });

    // Without this, mobile browsers/WebView intercept a one-finger drag as page scroll and a
    // two-finger pinch as page/viewport zoom before this controller's pointer handlers ever see
    // the gesture — `touch-action: none` is the standard, non-preventDefault-reliant way to opt a
    // specific element out of those default touch behaviors. Restored on `dispose()`.
    this.canvas.style.touchAction = 'none';
  }

  /** Recomputed by the experience once the model's real bounds are known (on load) and again on
   *  every viewport resize (Phase 2.4 brief §6) — this controller never computes bounds itself,
   *  it only enforces whatever limits it's given. */
  setDistanceLimits(min: number, max: number): void {
    this.minDistance = min;
    this.maxDistance = max;
    this.state.distance = clamp(this.state.distance, min, max);
  }

  /** Snaps to an exact yaw/pitch/distance — used once, when the model's bounds first become known
   *  (before that, the camera sits at an arbitrary placeholder pose with nothing loaded to frame). */
  setPose(yaw: number, pitch: number, distance: number): void {
    this.state.yaw = yaw;
    this.state.pitch = clamp(pitch, this.pitchRange[0], this.pitchRange[1]);
    this.state.distance = clamp(distance, this.minDistance, this.maxDistance);
  }

  /** Computes the camera's world position for the current orbit state around `target`. Kept as a
   *  pure read so the experience decides when to actually call `camera.setPosition`/`lookAt` (each
   *  frame is unnecessary — only on pointer/wheel input — but exposing it as a getter here keeps
   *  all the spherical-coordinate math in one place). */
  getPosition(target: pcNamespace.Vec3, pc: typeof pcNamespace): pcNamespace.Vec3 {
    const yawRad = this.state.yaw * DEG_TO_RAD;
    const pitchRad = this.state.pitch * DEG_TO_RAD;
    const horizontal = this.state.distance * Math.cos(pitchRad);
    return new pc.Vec3(
      target.x + horizontal * Math.sin(yawRad),
      target.y + this.state.distance * Math.sin(pitchRad),
      target.z + horizontal * Math.cos(yawRad),
    );
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.style.touchAction = '';
    this.pointers.clear();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pinchStartDistance = null;
    this.pinchStartCameraDistance = null;
    if (this.pointers.size === 1) {
      this.onInteractionChange?.(true);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    const current = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    if (this.pointers.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      this.state.yaw -= dx * this.rotateSpeed;
      this.state.pitch = clamp(this.state.pitch - dy * this.rotateSpeed, this.pitchRange[0], this.pitchRange[1]);
      return;
    }

    if (this.pointers.size === 2) {
      const points = [...this.pointers.values()];
      const pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (this.pinchStartDistance === null) {
        this.pinchStartDistance = pinchDistance;
        this.pinchStartCameraDistance = this.state.distance;
        return;
      }
      const ratio = this.pinchStartDistance / Math.max(pinchDistance, 1);
      this.state.distance = clamp((this.pinchStartCameraDistance ?? this.state.distance) * ratio, this.minDistance, this.maxDistance);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.pinchStartDistance = null;
    this.pinchStartCameraDistance = null;
    if (this.pointers.size === 0) {
      this.onInteractionChange?.(false);
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomFactor = 1 + clamp(event.deltaY, -100, 100) * 0.002;
    this.state.distance = clamp(this.state.distance * zoomFactor, this.minDistance, this.maxDistance);
  };
}

/** Merges the world-space `aabb` of every render-component mesh instance under `entity`'s subtree
 *  into one bounding box — the "deterministic framing method" Phase 2.4 §6 requires instead of a
 *  hardcoded camera position that would only ever be correct for one specific model/viewport. */
function computeWorldBounds(entity: pcNamespace.Entity, pc: typeof pcNamespace): pcNamespace.BoundingBox | null {
  let bounds: pcNamespace.BoundingBox | null = null;
  const renderComponents = entity.findComponents('render') as pcNamespace.RenderComponent[];
  for (const render of renderComponents) {
    for (const meshInstance of render.meshInstances) {
      if (!bounds) {
        bounds = new pc.BoundingBox();
        bounds.copy(meshInstance.aabb);
      } else {
        bounds.add(meshInstance.aabb);
      }
    }
  }
  return bounds;
}

/** The camera distance at which a sphere of `radius` is fully framed by a perspective camera with
 *  the given vertical `fovDegrees` and `aspect` ratio — takes whichever of the vertical/horizontal
 *  fit is more restrictive so the model stays fully in view in both portrait and landscape (Phase
 *  2.4 §6: "canvas resize, aspect ratio, model framing ... must all adapt"). */
function framingDistance(radius: number, fovDegrees: number, aspect: number): number {
  const verticalFovRad = fovDegrees * DEG_TO_RAD;
  const horizontalFovRad = 2 * Math.atan(Math.tan(verticalFovRad / 2) * aspect);
  const verticalFit = radius / Math.sin(verticalFovRad / 2);
  const horizontalFit = radius / Math.sin(horizontalFovRad / 2);
  return Math.max(verticalFit, horizontalFit);
}

/**
 * Phase 2.4's realistic-GLB + interactive-camera validation experience. Loads exactly one
 * realistic, license-clean, PBR model (`config.assets`'s one `'model'` reference — this
 * experience is deliberately single-model, unlike `technical-demo`'s multi-model layout, since an
 * orbit camera frames around ONE subject) through the same `Experience → loadModel → GlbLoader →
 * AssetRegistry.loadFromUrl('container', …) → instantiateRenderEntity` path every prior phase
 * used — no special loader, no bypass (Phase 2.4 brief §3).
 *
 * Camera: a from-scratch {@link OrbitCameraController} (see its own doc comment for why not
 * PlayCanvas's own alpha `OrbitController`) framed around the model's real bounding box once it
 * loads, reframed on every `resize()` (Phase 2.4 §6).
 *
 * Lighting: two directional lights — one key, one low-intensity fill — no shadows. A single
 * mid-sized PBR model with five textured materials plus one solid-value material doesn't need
 * shadow mapping to read as "realistic," and shadow map rendering is exactly the kind of
 * per-frame GPU cost this validation's mobile-conscious instruction (§8, and the Android SwiftShader
 * software-rendering constraint carried forward from Phase 2.2/2.3) says to avoid unless justified.
 *
 * Brand color: black background (this experience's `clearColor`) and a red(idle)/green(active)
 * indicator disc beneath the model reflect Phase 2.4 §7. The helmet's own PBR materials and both
 * lights are kept neutral/white deliberately — tinting either would misrepresent a realistic
 * asset's actual textures, which is the "necessary neutral value" §7 asks to be documented rather
 * than forced.
 */
export const createRealisticShowcaseExperience: ExperienceFactory = ({ pc, root, canvas, config, onUpdate, loadModel }: ExperienceContext): Experience => {
  const colors = resolveColors(config.settings);
  const debug = (config.settings as RealisticShowcaseSettings | undefined)?.debug === true;
  const initTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const camera = new pc.Entity('realistic-showcase-camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color().fromString(colors.background),
    fov: 45,
  });
  root.addChild(camera);

  const keyLight = new pc.Entity('realistic-showcase-key-light');
  keyLight.addComponent('light', { type: 'directional', intensity: 1.15, castShadows: false });
  keyLight.setEulerAngles(45, 30, 0);
  root.addChild(keyLight);

  const fillLight = new pc.Entity('realistic-showcase-fill-light');
  fillLight.addComponent('light', { type: 'directional', intensity: 0.35, castShadows: false });
  fillLight.setEulerAngles(-25, 200, 0);
  root.addChild(fillLight);

  // Placeholder pose used only until the model's real bounds are known — nothing is visible to
  // frame correctly before that anyway.
  const controller = new OrbitCameraController(canvas, 30, 15, 3);
  let target = new pc.Vec3(0, 0, 0);
  let boundsRadius = 1;
  let aspect = canvas.width > 0 && canvas.height > 0 ? canvas.width / canvas.height : 1;

  const indicator = new pc.Entity('realistic-showcase-indicator');
  indicator.addComponent('render', { type: 'cylinder' });
  const indicatorMaterial = new pc.StandardMaterial();
  indicatorMaterial.diffuse = new pc.Color(0.05, 0.05, 0.05);
  indicatorMaterial.emissive = new pc.Color().fromString(colors.highlight);
  indicatorMaterial.emissiveIntensity = 0.6;
  indicatorMaterial.update();
  root.addChild(indicator);
  if (indicator.render) {
    indicator.render.material = indicatorMaterial;
  }
  indicator.setLocalScale(1, 0.02, 1);
  indicator.setPosition(0, -0.001, 0);
  indicator.enabled = false; // enabled once the model's bounds size the disc correctly

  controller.onInteractionChange = (active) => {
    indicatorMaterial.emissive = new pc.Color().fromString(active ? colors.active : colors.highlight);
    indicatorMaterial.update();
  };

  function applyFraming(): void {
    const framed = framingDistance(boundsRadius, camera.camera?.fov ?? 45, aspect);
    const minDistance = boundsRadius * 1.3;
    const maxDistance = framed * 2.5;
    controller.setDistanceLimits(minDistance, maxDistance);
  }

  function tick(): void {
    const position = controller.getPosition(target, pc);
    camera.setPosition(position.x, position.y, position.z);
    camera.lookAt(target.x, target.y, target.z);
  }

  // Every frame, not just on pointer events — damping-free dragging still needs the camera to
  // reflect state that changed since the last render, and this keeps the render loop the single
  // source of truth for camera placement rather than duplicating position math inside the pointer
  // handlers themselves.
  onUpdate(() => tick());
  tick();

  let disposed = false;
  let modelEntity: pcNamespace.Entity | null = null;

  let frameCount = 0;
  let fpsWindowStart = initTimestamp;
  if (debug) {
    onUpdate(() => {
      frameCount += 1;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = now - fpsWindowStart;
      if (elapsed >= 1000) {
        console.info(`[realistic-showcase] fps: ${((frameCount * 1000) / elapsed).toFixed(1)}`);
        frameCount = 0;
        fpsWindowStart = now;
      }
    });
  }

  const modelAsset = config.assets?.find((asset) => asset.type === 'model');
  if (modelAsset) {
    void loadModel(modelAsset)
      .then((result) => {
        if (disposed) {
          // GlbLoader.dispose() (called by PlaycanvasRuntime.destroy() before this .then() can run
          // — both synchronous, see technical-demo.experience.ts's identical guard) already
          // discarded the load; unreachable in practice, guarded anyway.
          return;
        }

        if (debug) {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          console.info(`[realistic-showcase] model "${modelAsset.id}" load+init: ${(now - initTimestamp).toFixed(0)}ms`);
        }

        const entity = result.instantiate();
        root.addChild(entity);
        modelEntity = entity;

        const bounds = computeWorldBounds(entity, pc);
        if (bounds) {
          target = bounds.center.clone();
          boundsRadius = Math.max(bounds.halfExtents.length(), 0.01);
          applyFraming();
          const framed = framingDistance(boundsRadius, camera.camera?.fov ?? 45, aspect);
          controller.setPose(30, 15, framed * 1.4);
          if (camera.camera) {
            camera.camera.nearClip = boundsRadius * 0.02;
            camera.camera.farClip = framed * 20;
          }

          indicator.setLocalScale(boundsRadius * 2.2, 0.02, boundsRadius * 2.2);
          indicator.setPosition(target.x, bounds.center.y - bounds.halfExtents.y, target.z);
          indicator.enabled = true;
        }
      })
      .catch((error: unknown) => {
        // Fail cleanly, matching technical-demo.experience.ts's established pattern — a load
        // failure never leaves an unhandled rejection or crashes the rest of the scene (Phase 2.4
        // §11: "one model failing doesn't block others").
        console.error(`[realistic-showcase experience] model "${modelAsset.id}" failed to load:`, error);
      });
  }

  return {
    resize(width: number, height: number): void {
      aspect = height > 0 ? width / height : aspect;
      applyFraming();
    },
    dispose(): void {
      disposed = true;
      controller.dispose();
      modelEntity?.destroy();
      modelEntity = null;
      indicator.destroy();
      indicatorMaterial.destroy();
    },
  };
};
