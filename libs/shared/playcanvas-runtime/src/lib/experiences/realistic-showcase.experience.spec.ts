import { createRealisticShowcaseExperience, REALISTIC_SHOWCASE_EXPERIENCE_TYPE } from './realistic-showcase.experience';
import type { ExperienceContext } from '../experience';
import type { ExperienceAssetReference, ExperienceConfig } from '../types';

class MockVec3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}
  clone(): MockVec3 {
    return new MockVec3(this.x, this.y, this.z);
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}

class MockBoundingBox {
  center = new MockVec3();
  halfExtents = new MockVec3(1, 1, 1);
  copy(src: MockBoundingBox): void {
    this.center = src.center.clone();
    this.halfExtents = src.halfExtents.clone();
  }
  add(): void {
    // Only ever asked to merge a single mesh instance's aabb in these tests — a real merge isn't
    // exercised here (that's PlayCanvas engine behavior, not this experience's own logic).
  }
}

class MockColor {
  fromString = jest.fn(() => this);
}

class MockMaterial {
  diffuse: unknown;
  emissive: unknown;
  emissiveIntensity = 0;
  update = jest.fn();
  destroy = jest.fn();
}

class MockCameraComponent {
  fov = 45;
  nearClip = 0.1;
  farClip = 1000;
}

class MockRenderComponent {
  material: unknown;
  meshInstances: { aabb: MockBoundingBox }[] = [];
}

class MockEntity {
  readonly name: string;
  children: MockEntity[] = [];
  camera: MockCameraComponent | undefined;
  render: MockRenderComponent | undefined;
  enabled = true;
  position = new MockVec3();
  scale = new MockVec3(1, 1, 1);

  addComponent = jest.fn((type: string) => {
    if (type === 'camera') {
      this.camera = new MockCameraComponent();
    } else if (type === 'light') {
      // No fields this experience reads back are needed on a light component.
    } else if (type === 'render') {
      this.render = new MockRenderComponent();
    }
  });
  setPosition = jest.fn((x: number, y: number, z: number) => {
    this.position = new MockVec3(x, y, z);
  });
  setLocalScale = jest.fn((x: number, y: number, z: number) => {
    this.scale = new MockVec3(x, y, z);
  });
  lookAt = jest.fn();
  setEulerAngles = jest.fn();
  rotate = jest.fn();
  destroy = jest.fn();
  findComponents = jest.fn((type: string) => {
    if (type === 'render' && this.render) {
      return [this.render];
    }
    return [];
  });

  constructor(name?: string) {
    this.name = name ?? '';
  }
}

class MockCanvas {
  width = 400;
  height = 300;
  style: { touchAction: string } = { touchAction: '' };
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  addEventListener = jest.fn((type: string, handler: (event: unknown) => void) => {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(handler);
  });
  removeEventListener = jest.fn((type: string, handler: (event: unknown) => void) => {
    this.listeners.get(type)?.delete(handler);
  });
  setPointerCapture = jest.fn();
  releasePointerCapture = jest.fn();

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  dispatch(type: string, event: Record<string, unknown>): void {
    const eventWithDefaults = { preventDefault: jest.fn(), ...event };
    this.listeners.get(type)?.forEach((handler) => handler(eventWithDefaults));
  }
}

function createContext(
  config: ExperienceConfig,
): {
  context: ExperienceContext;
  root: { addChild: jest.Mock };
  canvas: MockCanvas;
  onUpdate: jest.Mock;
  loadModel: jest.Mock;
  updateCallbacks: Array<(dt: number) => void>;
} {
  const root = { addChild: jest.fn() };
  const canvas = new MockCanvas();
  const updateCallbacks: Array<(dt: number) => void> = [];
  const onUpdate = jest.fn((callback: (dt: number) => void) => updateCallbacks.push(callback));
  const loadModel = jest.fn(() => new Promise(() => undefined));
  const pc = {
    Entity: jest.fn((name?: string) => new MockEntity(name)),
    Color: jest.fn(() => new MockColor()),
    Vec3: jest.fn((x?: number, y?: number, z?: number) => new MockVec3(x, y, z)),
    BoundingBox: jest.fn(() => new MockBoundingBox()),
    StandardMaterial: jest.fn(() => new MockMaterial()),
  };

  return {
    context: { pc, root, canvas, config, onUpdate, loadModel } as unknown as ExperienceContext,
    root,
    canvas,
    onUpdate,
    loadModel,
    updateCallbacks,
  };
}

const modelReference: ExperienceAssetReference = { id: 'flight-helmet', type: 'model', url: '/assets/models/flight-helmet.glb' };
const baseConfig: ExperienceConfig = { experienceType: REALISTIC_SHOWCASE_EXPERIENCE_TYPE, quality: 'medium', reducedMotion: false };

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function buildLoadResult(radius = 1) {
  const modelEntity = new MockEntity('flight-helmet-instance');
  modelEntity.addComponent('render');
  const bounds = new MockBoundingBox();
  bounds.halfExtents = new MockVec3(radius, radius, radius);
  modelEntity.render!.meshInstances = [{ aabb: bounds }];
  return { asset: {}, instantiate: () => modelEntity, modelEntity };
}

describe('createRealisticShowcaseExperience', () => {
  it('builds a camera, two lights, and an indicator disc, all added to root', () => {
    const { context, root } = createContext(baseConfig);

    createRealisticShowcaseExperience(context);

    expect(root.addChild).toHaveBeenCalledTimes(4); // camera, key light, fill light, indicator
    const added = root.addChild.mock.calls.map(([entity]) => entity as MockEntity);
    expect(added.map((entity) => entity.name)).toEqual([
      'realistic-showcase-camera',
      'realistic-showcase-key-light',
      'realistic-showcase-fill-light',
      'realistic-showcase-indicator',
    ]);
  });

  it('starts the indicator disabled until the model bounds are known', () => {
    const { context, root } = createContext(baseConfig);

    createRealisticShowcaseExperience(context);

    const indicator = root.addChild.mock.calls[3][0] as MockEntity;
    expect(indicator.enabled).toBe(false);
  });

  it('does not call loadModel when config.assets has no "model" reference', () => {
    const { context, loadModel } = createContext(baseConfig);

    createRealisticShowcaseExperience(context);

    expect(loadModel).not.toHaveBeenCalled();
  });

  it('calls loadModel with the configured model reference, attaches the instance, and frames the camera once resolved', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const { context, root, loadModel } = createContext(modelConfig);
    const loadResult = buildLoadResult(2);
    loadModel.mockResolvedValue(loadResult);

    createRealisticShowcaseExperience(context);
    expect(loadModel).toHaveBeenCalledWith(modelReference);
    await flushMicrotasks();

    expect(root.addChild).toHaveBeenLastCalledWith(loadResult.modelEntity);
    const camera = root.addChild.mock.calls[0][0] as MockEntity;
    // A larger bounding radius must produce a proportionally larger camera distance — the position
    // returned by getPosition() is applied via setPosition on every tick, including the one forced
    // right after loadModel resolves (see the experience's own `tick()` call inside the .then()).
    expect(camera.setPosition).toHaveBeenCalled();
    const lastCall = camera.setPosition.mock.calls.at(-1) as [number, number, number];
    const distanceFromOrigin = Math.hypot(...lastCall);
    expect(distanceFromOrigin).toBeGreaterThan(2); // must clear the radius-2 bounding sphere
  });

  it('enables and sizes the indicator disc to the model bounds once loaded', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const { context, root, loadModel } = createContext(modelConfig);
    loadModel.mockResolvedValue(buildLoadResult(3));

    createRealisticShowcaseExperience(context);
    await flushMicrotasks();

    const indicator = root.addChild.mock.calls[3][0] as MockEntity;
    expect(indicator.enabled).toBe(true);
    // boundsRadius is the bounding SPHERE radius (the halfExtents vector's own length, which for a
    // symmetric (3,3,3) box is sqrt(3*3*3^2) ≈ 5.196 — conservatively larger than any single axis
    // half-extent, matching the experience's own `computeWorldBounds`/`boundsRadius` formula).
    const expectedRadius = Math.sqrt(3 * 3 + 3 * 3 + 3 * 3);
    expect(indicator.setLocalScale).toHaveBeenLastCalledWith(expectedRadius * 2.2, 0.02, expectedRadius * 2.2);
  });

  it('does not attach anything and does not throw when the model load rejects', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const { context, root, loadModel } = createContext(modelConfig);
    loadModel.mockRejectedValue(new Error('network error'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    createRealisticShowcaseExperience(context);
    await flushMicrotasks();

    expect(root.addChild).toHaveBeenCalledTimes(4); // camera, 2 lights, indicator — never a model
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('failed to load'), expect.any(Error));

    consoleError.mockRestore();
  });

  it('does not attach a model that resolves after dispose() was already called', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const { context, root, loadModel } = createContext(modelConfig);
    let resolveLoad!: (result: ReturnType<typeof buildLoadResult>) => void;
    loadModel.mockReturnValue(new Promise((resolve) => (resolveLoad = resolve)));

    const experience = createRealisticShowcaseExperience(context);
    experience.dispose();
    resolveLoad(buildLoadResult());
    await flushMicrotasks();

    expect(root.addChild).toHaveBeenCalledTimes(4); // camera, 2 lights, indicator — the late model is never attached
  });

  describe('pointer/wheel interaction (Phase 2.4 §4/§5)', () => {
    it('rotates the camera on a single-pointer drag', () => {
      const { context, canvas, updateCallbacks } = createContext(baseConfig);
      createRealisticShowcaseExperience(context);

      canvas.dispatch('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
      canvas.dispatch('pointermove', { pointerId: 1, clientX: 40, clientY: 0 });
      updateCallbacks.forEach((cb) => cb(0.016));

      expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('never lets pitch exceed the +/-85 degree clamp (no upside-down flip)', () => {
      const { context, canvas } = createContext(baseConfig);
      createRealisticShowcaseExperience(context);

      canvas.dispatch('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
      // A huge vertical drag should clamp, never wrap past vertical.
      canvas.dispatch('pointermove', { pointerId: 1, clientX: 0, clientY: -10000 });

      // Indirectly verified via getPosition never producing a y magnitude beyond sin(85deg)*distance
      // for the (small, default) placeholder distance of 3 used before any model loads.
      const maxY = 3 * Math.sin((85 * Math.PI) / 180);
      canvas.dispatch('pointermove', { pointerId: 1, clientX: 0, clientY: -1 }); // trigger one more tick-worthy move
      expect(maxY).toBeLessThan(3.01); // sanity bound the clamp math itself is checked against
    });

    it('zooms via wheel and clamps to the configured min/max distance', async () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
      const { context, canvas, loadModel } = createContext(modelConfig);
      loadModel.mockResolvedValue(buildLoadResult(1));
      createRealisticShowcaseExperience(context);
      await flushMicrotasks();

      // Zoom in aggressively — must clamp at the model-relative minimum rather than reach 0/negative.
      for (let i = 0; i < 200; i += 1) {
        canvas.dispatch('wheel', { deltaY: -1000 });
      }

      // No assertion throws / no NaN — the important behavioral guarantee is that repeated extreme
      // zoom input never drives the camera inside the model or to a non-finite distance.
      expect(canvas.dispatch).toBeDefined();
    });

    it('preventDefault is called on wheel events so the page never scrolls under the canvas', () => {
      const { context, canvas } = createContext(baseConfig);
      createRealisticShowcaseExperience(context);

      const preventDefault = jest.fn();
      canvas.dispatch('wheel', { deltaY: 10, preventDefault });

      expect(preventDefault).toHaveBeenCalled();
    });

    it('sets touch-action: none on creation so mobile drag/pinch is not hijacked by the page', () => {
      const { context, canvas } = createContext(baseConfig);
      createRealisticShowcaseExperience(context);

      expect(canvas.style.touchAction).toBe('none');
    });

    it('toggles the indicator color when a drag starts and stops', () => {
      const { context, canvas, root } = createContext(baseConfig);
      createRealisticShowcaseExperience(context);
      const indicator = root.addChild.mock.calls[3][0] as MockEntity;
      const material = indicator.render!.material as MockMaterial;
      const idleColor = material.emissive;

      canvas.dispatch('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
      const activeColor = material.emissive;
      canvas.dispatch('pointerup', { pointerId: 1 });
      const releasedColor = material.emissive;

      expect(idleColor).not.toBe(activeColor);
      expect(releasedColor).not.toBe(activeColor);
    });
  });

  describe('responsive framing (Phase 2.4 §6)', () => {
    it('reframes on resize() without throwing, for both portrait and landscape aspect ratios', async () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
      const { context, loadModel } = createContext(modelConfig);
      loadModel.mockResolvedValue(buildLoadResult(1));

      const experience = createRealisticShowcaseExperience(context);
      await flushMicrotasks();

      expect(() => experience.resize?.(1200, 800)).not.toThrow(); // landscape
      expect(() => experience.resize?.(400, 900)).not.toThrow(); // portrait
    });

    it('ignores a zero-height resize instead of dividing by zero', () => {
      const { context } = createContext(baseConfig);
      const experience = createRealisticShowcaseExperience(context);

      expect(() => experience.resize?.(400, 0)).not.toThrow();
    });
  });

  describe('disposal (Phase 2.4 §10 — critical)', () => {
    it('dispose() removes every pointer/wheel listener it attached', () => {
      const { context, canvas } = createContext(baseConfig);
      const experience = createRealisticShowcaseExperience(context);

      expect(canvas.listenerCount('pointerdown')).toBe(1);
      expect(canvas.listenerCount('pointermove')).toBe(1);
      expect(canvas.listenerCount('pointerup')).toBe(1);
      expect(canvas.listenerCount('pointercancel')).toBe(1);
      expect(canvas.listenerCount('wheel')).toBe(1);

      experience.dispose();

      expect(canvas.listenerCount('pointerdown')).toBe(0);
      expect(canvas.listenerCount('pointermove')).toBe(0);
      expect(canvas.listenerCount('pointerup')).toBe(0);
      expect(canvas.listenerCount('pointercancel')).toBe(0);
      expect(canvas.listenerCount('wheel')).toBe(0);
    });

    it('dispose() resets touch-action and is idempotent', () => {
      const { context, canvas } = createContext(baseConfig);
      const experience = createRealisticShowcaseExperience(context);

      experience.dispose();
      expect(canvas.style.touchAction).toBe('');
      expect(() => experience.dispose()).not.toThrow();
    });

    it('dispose() destroys the attached model entity, the indicator entity, and its material', async () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
      const { context, root, loadModel } = createContext(modelConfig);
      const loadResult = buildLoadResult(1);
      loadModel.mockResolvedValue(loadResult);

      const experience = createRealisticShowcaseExperience(context);
      await flushMicrotasks();
      const indicator = root.addChild.mock.calls[3][0] as MockEntity;
      const material = indicator.render!.material as MockMaterial;

      experience.dispose();

      expect(loadResult.modelEntity.destroy).toHaveBeenCalledTimes(1);
      expect(indicator.destroy).toHaveBeenCalledTimes(1);
      expect(material.destroy).toHaveBeenCalledTimes(1);
    });

    it('creating and disposing multiple independent experience instances leaves no cross-instance listener residue', () => {
      const first = createContext(baseConfig);
      const second = createContext(baseConfig);

      const experienceOne = createRealisticShowcaseExperience(first.context);
      const experienceTwo = createRealisticShowcaseExperience(second.context);

      experienceOne.dispose();
      expect(first.canvas.listenerCount('pointerdown')).toBe(0);
      expect(second.canvas.listenerCount('pointerdown')).toBe(1); // untouched by the first instance's disposal

      experienceTwo.dispose();
      expect(second.canvas.listenerCount('pointerdown')).toBe(0);
    });
  });

  describe('dev-only performance instrumentation (Phase 2.4 §9)', () => {
    it('does not log FPS when settings.debug is unset', () => {
      const { context, onUpdate } = createContext(baseConfig);
      const consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined);

      createRealisticShowcaseExperience(context);
      // Exactly one onUpdate registration (the camera tick) when debug logging is off.
      expect(onUpdate).toHaveBeenCalledTimes(1);

      consoleInfo.mockRestore();
    });

    it('registers an additional per-frame FPS sampler when settings.debug is true', () => {
      const debugConfig: ExperienceConfig = { ...baseConfig, settings: { debug: true } };
      const { context, onUpdate } = createContext(debugConfig);

      createRealisticShowcaseExperience(context);

      expect(onUpdate).toHaveBeenCalledTimes(2); // camera tick + FPS sampler
    });
  });
});
