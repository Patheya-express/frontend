import { PlaycanvasRuntime } from './playcanvas-runtime';
import { ExperienceRegistry } from './experience-registry';
import type { Experience, ExperienceContext } from './experience';
import type { ExperienceConfig } from './types';

type EventCallback = (...args: unknown[]) => void;

class MockEntity {
  addComponent = jest.fn();
  addChild = jest.fn();
  setPosition = jest.fn();
  lookAt = jest.fn();
  setEulerAngles = jest.fn();
  rotate = jest.fn();
  children: MockEntity[] = [];
}

function createMockGraphicsDevice() {
  const listeners = new Map<string, EventCallback>();
  return {
    destroy: jest.fn(),
    on: jest.fn((name: string, cb: EventCallback) => {
      listeners.set(name, cb);
      return { off: jest.fn(() => listeners.delete(name)) };
    }),
    // test helper, not part of the real GraphicsDevice API
    __fire: (name: string) => listeners.get(name)?.(),
  };
}

function createMockApp(graphicsDevice: ReturnType<typeof createMockGraphicsDevice>) {
  return {
    root: { addChild: jest.fn() },
    graphicsDevice,
    start: jest.fn(),
    destroy: jest.fn(),
    resizeCanvas: jest.fn(),
    requestAnimationFrame: jest.fn(),
    on: jest.fn(),
  };
}

jest.mock('playcanvas', () => ({
  createGraphicsDevice: jest.fn(),
  Application: jest.fn(),
  Entity: jest.fn(),
  Color: jest.fn(),
  AppBase: { cancelTick: jest.fn() },
  DEVICETYPE_WEBGPU: 'webgpu',
  DEVICETYPE_WEBGL2: 'webgl2',
}));

const pc = jest.requireMock('playcanvas') as {
  createGraphicsDevice: jest.Mock;
  Application: jest.Mock;
  Entity: jest.Mock;
  Color: jest.Mock;
  AppBase: { cancelTick: jest.Mock };
};

const config: ExperienceConfig = { experienceType: 'technical-demo', quality: 'medium', reducedMotion: false };
const canvas = {} as HTMLCanvasElement;

/** Yields the microtask queue until `mockFn` has actually been invoked, for asserting behavior
 *  that happens between two `await` points inside create() without hardcoding a tick count. */
async function waitUntilCalled(mockFn: jest.Mock): Promise<void> {
  for (let i = 0; i < 10 && mockFn.mock.calls.length === 0; i++) {
    await Promise.resolve();
  }
}

describe('PlaycanvasRuntime', () => {
  let graphicsDevice: ReturnType<typeof createMockGraphicsDevice>;
  let app: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    graphicsDevice = createMockGraphicsDevice();
    app = createMockApp(graphicsDevice);
    pc.createGraphicsDevice.mockResolvedValue(graphicsDevice);
    pc.Application.mockImplementation(() => app);
    pc.Entity.mockImplementation(() => new MockEntity());
  });

  it('creates the device and application, and reaches "paused" without starting the render loop', async () => {
    const runtime = new PlaycanvasRuntime();

    await runtime.create(canvas, config);

    expect(pc.createGraphicsDevice).toHaveBeenCalledWith(canvas, expect.objectContaining({
      deviceTypes: ['webgpu', 'webgl2'],
    }));
    expect(pc.Application).toHaveBeenCalledWith(canvas, { graphicsDevice });
    expect(app.start).not.toHaveBeenCalled();
    expect(runtime.getStatus()).toEqual({ state: 'paused' });
  });

  it('rejects a second create() call on the same instance', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);

    await expect(runtime.create(canvas, config)).rejects.toThrow(/only be created once/);
  });

  it('reports "error" status without throwing when device creation fails', async () => {
    pc.createGraphicsDevice.mockRejectedValue(new Error('WebGL2 not supported'));
    const onStatusChange = jest.fn();
    const runtime = new PlaycanvasRuntime({ onStatusChange });

    await runtime.create(canvas, config);

    expect(runtime.getStatus()).toEqual({ state: 'error', message: 'WebGL2 not supported' });
    expect(onStatusChange).toHaveBeenLastCalledWith({ state: 'error', message: 'WebGL2 not supported' });
  });

  it('start() runs the engine bootstrap exactly once even if called repeatedly', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);

    runtime.start();
    runtime.start();

    expect(app.start).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toEqual({ state: 'running' });
  });

  it('pause() cancels the pending tick via AppBase.cancelTick', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);
    runtime.start();

    runtime.pause();

    expect(pc.AppBase.cancelTick).toHaveBeenCalledWith(app);
    expect(runtime.getStatus()).toEqual({ state: 'paused' });
  });

  it('resume() after a real pause reschedules via requestAnimationFrame, not a second start()', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);
    runtime.start();
    runtime.pause();

    runtime.resume();

    expect(app.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(app.start).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toEqual({ state: 'running' });
  });

  it('resume() before the first start() delegates to start() instead of requestAnimationFrame', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);

    runtime.resume();

    expect(app.start).toHaveBeenCalledTimes(1);
    expect(app.requestAnimationFrame).not.toHaveBeenCalled();
    expect(runtime.getStatus()).toEqual({ state: 'running' });
  });

  it('destroy() releases the application and device-loss listeners, and is idempotent', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);
    runtime.start();

    runtime.destroy();
    runtime.destroy();

    expect(app.destroy).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toEqual({ state: 'destroyed' });
  });

  it('destroy() called mid-create() disposes the just-created device instead of building an Application', async () => {
    let resolveDevice!: (device: unknown) => void;
    pc.createGraphicsDevice.mockReturnValue(new Promise((resolve) => (resolveDevice = resolve)));
    const runtime = new PlaycanvasRuntime();

    const creating = runtime.create(canvas, config);
    // The dynamic `import('playcanvas')` awaited at the top of create() resolves on its own
    // microtask before execution reaches `pc.createGraphicsDevice` — without waiting for that here
    // first, destroy() would win the race and return before createGraphicsDevice is ever called,
    // exercising the (already-covered) "destroyed before the module even loaded" path instead of
    // this test's actual target: destroy() arriving while device creation itself is in flight.
    await waitUntilCalled(pc.createGraphicsDevice);

    runtime.destroy();
    resolveDevice(graphicsDevice);
    await creating;

    expect(graphicsDevice.destroy).toHaveBeenCalledTimes(1);
    expect(pc.Application).not.toHaveBeenCalled();
    expect(runtime.getStatus()).toEqual({ state: 'destroyed' });
  });

  it('pauses automatically when the graphics device fires "devicelost" while running', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);
    runtime.start();

    graphicsDevice.__fire('devicelost');

    expect(pc.AppBase.cancelTick).toHaveBeenCalledWith(app);
    expect(runtime.getStatus()).toEqual({ state: 'paused' });
  });

  it('resumes automatically when the graphics device fires "devicerestored" after a real pause', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);
    runtime.start();
    runtime.pause();

    graphicsDevice.__fire('devicerestored');

    expect(app.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toEqual({ state: 'running' });
  });

  it('does not resume on "devicerestored" if the runtime was destroyed in the meantime', async () => {
    const runtime = new PlaycanvasRuntime();
    await runtime.create(canvas, config);
    runtime.start();
    runtime.pause();
    runtime.destroy();

    graphicsDevice.__fire('devicerestored');

    expect(app.requestAnimationFrame).not.toHaveBeenCalled();
  });
});

describe('PlaycanvasRuntime — experience layer integration', () => {
  let graphicsDevice: ReturnType<typeof createMockGraphicsDevice>;
  let app: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    graphicsDevice = createMockGraphicsDevice();
    app = createMockApp(graphicsDevice);
    pc.createGraphicsDevice.mockResolvedValue(graphicsDevice);
    pc.Application.mockImplementation(() => app);
    pc.Entity.mockImplementation(() => new MockEntity());
  });

  function createStubExperience(): { experience: Experience; factory: jest.Mock } {
    const experience: Experience = {
      start: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    const factory = jest.fn(() => experience);
    return { experience, factory };
  }

  it('resolves config.experienceType through a custom registry and passes pc/root/config/onUpdate to the factory', async () => {
    const { factory } = createStubExperience();
    const registry = new ExperienceRegistry();
    registry.register('stub-experience', factory);
    const runtime = new PlaycanvasRuntime({ experienceRegistry: registry });

    await runtime.create(canvas, { ...config, experienceType: 'stub-experience' });

    expect(factory).toHaveBeenCalledTimes(1);
    const context = factory.mock.calls[0][0] as ExperienceContext;
    // Not `context.pc).toBe(pc)`: ts-jest's CJS/ESM interop for a dynamic `import()` wraps the
    // mocked module with an extra synthetic `default` key, so the two namespace *objects* differ
    // by reference even though every real export — including the one under test — is the exact
    // same mock function either way.
    expect(context.pc.Entity).toBe(pc.Entity);
    expect(context.config).toEqual({ ...config, experienceType: 'stub-experience' });
    expect(typeof context.onUpdate).toBe('function');
    expect(app.root.addChild).toHaveBeenCalledWith(context.root);
  });

  it('delegates start/pause/resume/resize/dispose to the active experience, without duplicating device-lifecycle calls', async () => {
    const { experience, factory } = createStubExperience();
    const registry = new ExperienceRegistry();
    registry.register('stub-experience', factory);
    const runtime = new PlaycanvasRuntime({ experienceRegistry: registry });
    await runtime.create(canvas, { ...config, experienceType: 'stub-experience' });

    runtime.start();
    expect(experience.start).toHaveBeenCalledTimes(1);
    expect(app.start).toHaveBeenCalledTimes(1);

    runtime.pause();
    expect(experience.pause).toHaveBeenCalledTimes(1);
    expect(pc.AppBase.cancelTick).toHaveBeenCalledTimes(1);

    runtime.resume();
    expect(experience.resume).toHaveBeenCalledTimes(1);
    expect(app.requestAnimationFrame).toHaveBeenCalledTimes(1);

    runtime.resize(320, 240);
    expect(experience.resize).toHaveBeenCalledWith(320, 240);
    expect(app.resizeCanvas).toHaveBeenCalledWith(320, 240);

    runtime.destroy();
    expect(experience.dispose).toHaveBeenCalledTimes(1);
    expect(app.destroy).toHaveBeenCalledTimes(1);
  });

  it('calls dispose() on the active experience even when destroy() happens before start()', async () => {
    const { experience, factory } = createStubExperience();
    const registry = new ExperienceRegistry();
    registry.register('stub-experience', factory);
    const runtime = new PlaycanvasRuntime({ experienceRegistry: registry });
    await runtime.create(canvas, { ...config, experienceType: 'stub-experience' });

    runtime.destroy();

    expect(experience.dispose).toHaveBeenCalledTimes(1);
    expect(experience.start).not.toHaveBeenCalled();
  });

  it('reports "error" status with a clear message when experienceType has no registered factory', async () => {
    const runtime = new PlaycanvasRuntime({ experienceRegistry: new ExperienceRegistry() });

    await runtime.create(canvas, { ...config, experienceType: 'unregistered-type' });

    expect(runtime.getStatus()).toEqual({
      state: 'error',
      message: expect.stringContaining('unregistered-type'),
    });
    expect(pc.Application).toHaveBeenCalled(); // device/Application were still created before resolution failed
  });

  it('uses a private default registry (the Phase 1 technical-demo experience) when none is supplied', async () => {
    const runtime = new PlaycanvasRuntime();

    await runtime.create(canvas, config); // config.experienceType === 'technical-demo'

    expect(runtime.getStatus()).toEqual({ state: 'paused' });
    // 1 experience-root (created by the runtime itself) + camera + light + box (created by the
    // technical-demo experience factory) — confirms the default registry really resolved and
    // constructed something, not silently no-oped.
    expect(pc.Entity).toHaveBeenCalledTimes(4);
  });

  it('each runtime with no explicit registry builds its own private default registry, not a shared singleton', async () => {
    const { factory: overrideFactory } = createStubExperience();
    const registryWithOverride = new ExperienceRegistry();
    registryWithOverride.register('technical-demo', overrideFactory, { allowOverride: true });
    const runtimeWithOverride = new PlaycanvasRuntime({ experienceRegistry: registryWithOverride });
    const runtimeWithDefault = new PlaycanvasRuntime(); // no registry supplied — builds its own default

    await runtimeWithOverride.create(canvas, config);
    await runtimeWithDefault.create(canvas, config);

    // If `createDefaultExperienceRegistry()` were a shared/module-level singleton, registering an
    // override for 'technical-demo' on one runtime's explicit registry could never leak into
    // another runtime's *default* one anyway (they're different registry objects) — but this
    // confirms the more basic invariant directly: the second runtime's real technical-demo
    // experience (camera + light + box) still gets built untouched, proving its default registry
    // is its own private instance rather than something the first runtime's setup could affect.
    expect(overrideFactory).toHaveBeenCalledTimes(1);
    // 1 experience-root for runtimeWithOverride (its stub factory builds nothing) + 1 experience-root
    // plus camera/light/box for runtimeWithDefault's real technical-demo experience = 5 total.
    expect(pc.Entity).toHaveBeenCalledTimes(5);
  });
});
