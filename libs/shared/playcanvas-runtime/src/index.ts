// Narrow public barrel by design (architecture validation §12/§23, Phase 1 brief §3/§23): this is
// the ONLY file consumers of this library import from. It exports the runtime contract, the
// generic experience/registry contracts, and their plain-data types — never the `playcanvas`
// namespace itself and never an experience implementation's own internals — so nothing outside
// this library can reach into PlayCanvas's own object graph (Application/Entity/AssetRegistry/
// GraphicsDevice), and so a static import of this barrel from an eagerly-loaded file pulls in only
// this small contract, not PlayCanvas.
export * from './lib/playcanvas-runtime';
export * from './lib/types';
export * from './lib/experience';
export * from './lib/experience-registry';
export { createDefaultExperienceRegistry } from './lib/default-experience-registry';
export { TECHNICAL_DEMO_EXPERIENCE_TYPE } from './lib/experiences/technical-demo.experience';
