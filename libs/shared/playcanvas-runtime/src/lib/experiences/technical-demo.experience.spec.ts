import { createTechnicalDemoExperience, TECHNICAL_DEMO_EXPERIENCE_TYPE } from './technical-demo.experience';
import type { ExperienceContext } from '../experience';
import type { ExperienceAssetReference, ExperienceConfig } from '../types';

class MockEntity {
  readonly name: string;
  addComponent = jest.fn();
  setPosition = jest.fn();
  lookAt = jest.fn();
  setEulerAngles = jest.fn();
  rotate = jest.fn();
  destroy = jest.fn();
  children: MockEntity[] = [];

  constructor(name?: string) {
    this.name = name ?? '';
  }
}

function createContext(
  config: ExperienceConfig,
): { context: ExperienceContext; root: { addChild: jest.Mock }; onUpdate: jest.Mock; loadModel: jest.Mock } {
  const root = { addChild: jest.fn() };
  const onUpdate = jest.fn();
  const loadModel = jest.fn(() => new Promise(() => undefined)); // never resolves unless a test overrides it
  const pc = {
    Entity: jest.fn((name?: string) => new MockEntity(name)),
    Color: jest.fn(),
  };

  return {
    // Deliberately not the real `typeof pcNamespace` — this test only exercises what the factory
    // actually touches (`Entity`, `Color`), the same GPU-independent spirit as the runtime's own
    // mocked-`playcanvas` tests, just without needing `jest.mock('playcanvas', ...)` at all since
    // `pc` here is a plain constructor parameter, not a module import.
    context: { pc, root, config, onUpdate, loadModel } as unknown as ExperienceContext,
    root,
    onUpdate,
    loadModel,
  };
}

const modelReference: ExperienceAssetReference = { id: 'sample-triangle', type: 'model', url: '/assets/models/sample-triangle.glb' };
const texturedModelReference: ExperienceAssetReference = {
  id: 'sample-textured',
  type: 'model',
  url: '/assets/models/sample-textured.glb',
};

/** Flushes pending microtasks so a promise's `.then()`/`.catch()` continuation has run. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const baseConfig: ExperienceConfig = { experienceType: TECHNICAL_DEMO_EXPERIENCE_TYPE, quality: 'medium', reducedMotion: false };

describe('createTechnicalDemoExperience', () => {
  it('builds exactly one camera, one light, and one box, all added to the provided root', () => {
    const { context, root } = createContext(baseConfig);

    createTechnicalDemoExperience(context);

    expect(root.addChild).toHaveBeenCalledTimes(3);
    const added = root.addChild.mock.calls.map(([entity]) => entity as MockEntity);
    expect(added.map((entity) => entity.name)).toEqual(['camera', 'light', 'technical-demo-box']);
  });

  it('configures the camera and light components', () => {
    const { context, root } = createContext(baseConfig);

    createTechnicalDemoExperience(context);

    const [camera, light] = root.addChild.mock.calls.map(([entity]) => entity as MockEntity);
    expect(camera.addComponent).toHaveBeenCalledWith('camera', expect.objectContaining({}));
    expect(camera.setPosition).toHaveBeenCalledWith(0, 0.6, 3);
    expect(camera.lookAt).toHaveBeenCalledWith(0, 0, 0);
    expect(light.addComponent).toHaveBeenCalledWith('light', { type: 'directional' });
  });

  it('registers a rotation update callback when reducedMotion is false', () => {
    const { context, onUpdate } = createContext({ ...baseConfig, reducedMotion: false });

    createTechnicalDemoExperience(context);

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not register any update callback when reducedMotion is true', () => {
    const { context, onUpdate } = createContext({ ...baseConfig, reducedMotion: true });

    createTechnicalDemoExperience(context);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('the registered update callback rotates the box entity', () => {
    const { context, root, onUpdate } = createContext({ ...baseConfig, reducedMotion: false });

    createTechnicalDemoExperience(context);
    const box = root.addChild.mock.calls[2][0] as MockEntity;
    const rotateCallback = onUpdate.mock.calls[0][0] as (dt: number) => void;
    rotateCallback(0.5);

    expect(box.rotate).toHaveBeenCalledWith(4.5, 7, 0);
  });

  it('returns an experience whose dispose() does not throw', () => {
    const { context } = createContext(baseConfig);

    const experience = createTechnicalDemoExperience(context);

    expect(() => experience.dispose()).not.toThrow();
  });

  it('does not call loadModel when config.assets has no "model" reference', () => {
    const { context, loadModel } = createContext(baseConfig);

    createTechnicalDemoExperience(context);

    expect(loadModel).not.toHaveBeenCalled();
  });

  it('calls loadModel with the configured "model" reference and attaches the instantiated entity once it resolves', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const instantiatedEntity = new MockEntity('sample-triangle-instance');
    const instantiate = jest.fn(() => instantiatedEntity);
    let resolveLoad!: (result: { asset: unknown; instantiate: typeof instantiate }) => void;
    const { context, root, loadModel } = createContext(modelConfig);
    loadModel.mockReturnValue(new Promise((resolve) => (resolveLoad = resolve)));

    createTechnicalDemoExperience(context);
    expect(loadModel).toHaveBeenCalledWith(modelReference);
    expect(root.addChild).toHaveBeenCalledTimes(3); // camera, light, box — model not attached yet

    resolveLoad({ asset: {}, instantiate });
    await flushMicrotasks();

    expect(instantiate).toHaveBeenCalledTimes(1);
    expect(instantiatedEntity.setPosition).toHaveBeenCalledWith(1, 0, 0);
    expect(root.addChild).toHaveBeenCalledTimes(4);
    expect(root.addChild).toHaveBeenLastCalledWith(instantiatedEntity);
  });

  it('does not attach anything and does not throw when the model load rejects', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    let rejectLoad!: (error: unknown) => void;
    const { context, root, loadModel } = createContext(modelConfig);
    loadModel.mockReturnValue(new Promise((_resolve, reject) => (rejectLoad = reject)));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    createTechnicalDemoExperience(context);
    rejectLoad(new Error('network error'));
    await flushMicrotasks();

    expect(root.addChild).toHaveBeenCalledTimes(3); // camera, light, box only — never a 4th call
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('failed to load'), expect.any(Error));

    consoleError.mockRestore();
  });

  it('destroys the attached model entity on dispose()', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const instantiatedEntity = new MockEntity('sample-triangle-instance');
    const { context, loadModel } = createContext(modelConfig);
    loadModel.mockResolvedValue({ asset: {}, instantiate: () => instantiatedEntity });

    const experience = createTechnicalDemoExperience(context);
    await flushMicrotasks();
    experience.dispose();

    expect(instantiatedEntity.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not attach a model that resolves after dispose() was already called', async () => {
    const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference] };
    const instantiatedEntity = new MockEntity('sample-triangle-instance');
    const instantiate = jest.fn(() => instantiatedEntity);
    let resolveLoad!: (result: { asset: unknown; instantiate: typeof instantiate }) => void;
    const { context, root, loadModel } = createContext(modelConfig);
    loadModel.mockReturnValue(new Promise((resolve) => (resolveLoad = resolve)));

    const experience = createTechnicalDemoExperience(context);
    experience.dispose();
    resolveLoad({ asset: {}, instantiate });
    await flushMicrotasks();

    expect(root.addChild).toHaveBeenCalledTimes(3); // camera, light, box — the late model is never attached
  });

  describe('multiple "model" assets (Phase 2.3 — untextured + textured side by side)', () => {
    it('calls loadModel once per configured "model" reference, in order', () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference, texturedModelReference] };
      const { context, loadModel } = createContext(modelConfig);

      createTechnicalDemoExperience(context);

      expect(loadModel).toHaveBeenCalledTimes(2);
      expect(loadModel).toHaveBeenNthCalledWith(1, modelReference);
      expect(loadModel).toHaveBeenNthCalledWith(2, texturedModelReference);
    });

    it('attaches both models at distinct, non-overlapping positions once each resolves', async () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference, texturedModelReference] };
      const triangleEntity = new MockEntity('sample-triangle-instance');
      const texturedEntity = new MockEntity('sample-textured-instance');
      const { context, root, loadModel } = createContext(modelConfig);
      loadModel.mockImplementation((reference: ExperienceAssetReference) =>
        Promise.resolve({
          asset: {},
          instantiate: () => (reference.id === modelReference.id ? triangleEntity : texturedEntity),
        }),
      );

      createTechnicalDemoExperience(context);
      await flushMicrotasks();

      expect(root.addChild).toHaveBeenCalledTimes(5); // camera, light, box, + 2 models
      // Alternating sides (index 0 → +1, index 1 → -1) — both stay within the camera's own view
      // frustum and clear of the rotating box, unlike an earlier same-side/1.4-step layout that
      // put the second model off-screen at x=2.6 (a real bug found via on-device testing — see
      // this file's own doc comment).
      expect(triangleEntity.setPosition).toHaveBeenCalledWith(1, 0, 0);
      expect(texturedEntity.setPosition).toHaveBeenCalledWith(-1, 0, 0);
    });

    it('still attaches the model that succeeds when the other one fails', async () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference, texturedModelReference] };
      const texturedEntity = new MockEntity('sample-textured-instance');
      const { context, root, loadModel } = createContext(modelConfig);
      loadModel.mockImplementation((reference: ExperienceAssetReference) =>
        reference.id === modelReference.id
          ? Promise.reject(new Error('untextured load failed'))
          : Promise.resolve({ asset: {}, instantiate: () => texturedEntity }),
      );
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      createTechnicalDemoExperience(context);
      await flushMicrotasks();

      expect(root.addChild).toHaveBeenCalledTimes(4); // camera, light, box, + the one that succeeded
      expect(root.addChild).toHaveBeenCalledWith(texturedEntity);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(modelReference.id), expect.any(Error));

      consoleError.mockRestore();
    });

    it('destroys every attached model entity on dispose()', async () => {
      const modelConfig: ExperienceConfig = { ...baseConfig, assets: [modelReference, texturedModelReference] };
      const triangleEntity = new MockEntity('sample-triangle-instance');
      const texturedEntity = new MockEntity('sample-textured-instance');
      const { context, loadModel } = createContext(modelConfig);
      loadModel.mockImplementation((reference: ExperienceAssetReference) =>
        Promise.resolve({
          asset: {},
          instantiate: () => (reference.id === modelReference.id ? triangleEntity : texturedEntity),
        }),
      );

      const experience = createTechnicalDemoExperience(context);
      await flushMicrotasks();
      experience.dispose();

      expect(triangleEntity.destroy).toHaveBeenCalledTimes(1);
      expect(texturedEntity.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
