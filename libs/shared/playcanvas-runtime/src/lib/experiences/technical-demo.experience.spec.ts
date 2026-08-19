import { createTechnicalDemoExperience, TECHNICAL_DEMO_EXPERIENCE_TYPE } from './technical-demo.experience';
import type { ExperienceContext } from '../experience';
import type { ExperienceConfig } from '../types';

class MockEntity {
  readonly name: string;
  addComponent = jest.fn();
  setPosition = jest.fn();
  lookAt = jest.fn();
  setEulerAngles = jest.fn();
  rotate = jest.fn();
  children: MockEntity[] = [];

  constructor(name?: string) {
    this.name = name ?? '';
  }
}

function createContext(config: ExperienceConfig): { context: ExperienceContext; root: { addChild: jest.Mock }; onUpdate: jest.Mock } {
  const root = { addChild: jest.fn() };
  const onUpdate = jest.fn();
  const pc = {
    Entity: jest.fn((name?: string) => new MockEntity(name)),
    Color: jest.fn(),
  };

  return {
    // Deliberately not the real `typeof pcNamespace` — this test only exercises what the factory
    // actually touches (`Entity`, `Color`), the same GPU-independent spirit as the runtime's own
    // mocked-`playcanvas` tests, just without needing `jest.mock('playcanvas', ...)` at all since
    // `pc` here is a plain constructor parameter, not a module import.
    context: { pc, root, config, onUpdate } as unknown as ExperienceContext,
    root,
    onUpdate,
  };
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
});
