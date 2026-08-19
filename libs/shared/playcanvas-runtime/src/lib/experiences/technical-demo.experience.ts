import type { Experience, ExperienceContext, ExperienceFactory } from '../experience';

/** Phase 2.1's one registered experience type — see `createDefaultExperienceRegistry`. */
export const TECHNICAL_DEMO_EXPERIENCE_TYPE = 'technical-demo';

/**
 * Phase 1's entire scene, unchanged in behavior, now shaped as an {@link ExperienceFactory} — the
 * registry's one minimal proof that a real experience implementation can be resolved and
 * constructed generically instead of being hardcoded inside `PlaycanvasRuntime.create()`. Still
 * not a product feature (Phase 2.1 brief §11): one camera, one light, one box, rotating unless
 * `reducedMotion` is set. Business experiences (product showcase, restaurant exploration, …) are
 * explicitly future work — see this library's README.
 */
export const createTechnicalDemoExperience: ExperienceFactory = ({ pc, root, config, onUpdate }: ExperienceContext): Experience => {
  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(0.09, 0.09, 0.1),
  });
  camera.setPosition(0, 0.6, 3);
  camera.lookAt(0, 0, 0);
  root.addChild(camera);

  const light = new pc.Entity('light');
  light.addComponent('light', { type: 'directional' });
  light.setEulerAngles(45, 30, 0);
  root.addChild(light);

  const box = new pc.Entity('technical-demo-box');
  box.addComponent('render', { type: 'box' });
  root.addChild(box);

  if (!config.reducedMotion) {
    onUpdate((dt) => box.rotate(9 * dt, 14 * dt, 0));
  }

  return {
    // Nothing beyond `root`'s own subtree — always destroyed by PlaycanvasRuntime regardless — and
    // no non-entity resources (timers, textures loaded outside the entity tree) to release yet.
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op, see above
    dispose(): void {},
  };
};
