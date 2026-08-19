import type { Entity } from 'playcanvas';
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
 *
 * As of Phase 2.2, if `config.assets` contains one or more `'model'` references, this also loads
 * each as a GLB via `context.loadModel` and attaches it alongside the box — proving the
 * `ExperienceAssetReference → GlbLoader → PlayCanvas Asset → Experience → rendered model` path end
 * to end (Phase 2.2 brief §4) without changing any of the box's own pre-existing behavior or
 * removing the network-independent baseline Phase 1 already proved. The box is never replaced by
 * any model: if no `'model'` asset is configured, or every load fails, the scene is exactly Phase
 * 2.1's — camera, light, rotating box, nothing else.
 *
 * As of Phase 2.3, "one or more" is exercised for real: `config.assets` may carry both the
 * untextured Phase 2.2 sample and a textured one side by side, each loaded and attached completely
 * independently — proving a textured/material-bearing GLB needs no different handling than a bare
 * one. `GlbLoader`/`AssetRegistry.loadFromUrl('container', …)` already parses a glTF material and
 * its base-color texture as part of ordinary container loading (verified against PlayCanvas's own
 * documented resource-type table before writing this — materials, images, and textures are
 * standard glTF container resources, not something this loader needs special-casing for), so no
 * loader change was needed for this phase.
 */
export const createTechnicalDemoExperience: ExperienceFactory = ({ pc, root, config, onUpdate, loadModel }: ExperienceContext): Experience => {
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

  let disposed = false;
  const modelEntities: Entity[] = [];

  const modelAssets = config.assets?.filter((asset) => asset.type === 'model') ?? [];
  modelAssets.forEach((modelAsset, index) => {
    void loadModel(modelAsset)
      .then((result) => {
        if (disposed) {
          // Experience was disposed before the load resolved. GlbLoader.dispose() (called by
          // PlaycanvasRuntime.destroy() before this promise's continuation can even run — both are
          // synchronous, so there is no race here) already discarded the load before it reached
          // this .then() at all — this branch is unreachable in practice but guarded anyway, the
          // same defensive-and-tested-explicitly posture as PlaycanvasRuntime.create() itself.
          return;
        }

        const entity = result.instantiate();
        // Offset each loaded model along X, alternating left/right of the box, so multiple models
        // remain independently visible within the camera's own frustum — this is a technical
        // validation layout, not a composed product scene; exact placement carries no meaning
        // beyond "stay on screen and don't overlap." A prior version offset every model to the
        // same side at 1.4-unit steps (1.2, 2.6, …) — the second model landed at x=2.6, outside
        // the visible half-width at the origin plane for this camera's position/FOV (~±1.2 at
        // `camera.setPosition(0, 0.6, 3)`'s distance) — invisible despite loading successfully,
        // caught only by actually looking at the rendered frame on a device (see this library's
        // Phase 2.3 notes). Alternating sides at a tighter 0.9-unit step keeps every model in view
        // without touching the camera itself.
        const side = index % 2 === 0 ? 1 : -1;
        const magnitude = 1 + Math.floor(index / 2) * 1;
        entity.setPosition(side * magnitude, 0, 0);
        root.addChild(entity);
        modelEntities.push(entity);
      })
      .catch((error: unknown) => {
        // Fail cleanly (Phase 2.2 brief §6): no unhandled rejection, no crash. The technical scene
        // simply keeps rendering its box and any other model that DID load — one bad reference
        // never takes the rest of the experience down with it.
        console.error(`[technical-demo experience] model "${modelAsset.id}" failed to load:`, error);
      });
  });

  return {
    dispose(): void {
      disposed = true;
      // `root`'s entire subtree — including every entity in modelEntities, if any were attached —
      // is destroyed by PlaycanvasRuntime regardless (see Experience's own doc comment), so this
      // is a belt-and-suspenders explicit release rather than something strictly required for
      // correctness; it does mean a still-loading model never gets silently attached to an
      // already-disposing root.
      modelEntities.forEach((entity) => entity.destroy());
      modelEntities.length = 0;
    },
  };
};
