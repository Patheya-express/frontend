// Narrow public barrel (architecture validation §12/§23, Phase 1 brief §23): the Angular adapter
// component plus the plain-data types its `@Input`/`@Output` surface uses — nothing from
// `playcanvas` itself is re-exported here. `ExperienceRegistry` is re-exported as a real value
// (not just a type) since building one to pass to `[experienceRegistry]` is the expected way a
// future feature plugs its own experience factories in — see that Input's own doc comment.
// Building an actual experience factory needs the `Experience`/`ExperienceContext`/
// `ExperienceFactory` contracts too, imported directly from `@patheya-express-frontend/playcanvas-runtime`
// instead of duplicated through this barrel — that's inherently a playcanvas-runtime-level concern.
export * from './lib/playcanvas-scene/playcanvas-scene.component';
export {
  ExperienceRegistry,
  type ExperienceRegistrationOptions,
  type RuntimeStatus,
  type RuntimeState,
  type QualityTier,
  type ExperienceConfig,
  type ExperienceAssetReference,
  type ExperienceAssetType,
} from '@patheya-express-frontend/playcanvas-runtime';
