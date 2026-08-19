import { ExperienceRegistry } from './experience-registry';
import { createRealisticShowcaseExperience, REALISTIC_SHOWCASE_EXPERIENCE_TYPE } from './experiences/realistic-showcase.experience';
import { createTechnicalDemoExperience, TECHNICAL_DEMO_EXPERIENCE_TYPE } from './experiences/technical-demo.experience';

/**
 * The registry every `PlaycanvasRuntime` uses when no custom `experienceRegistry` is supplied via
 * `PlaycanvasRuntimeOptions` — registers only the Phase 1 technical-demo experience. Deliberately
 * not the place a future business domain registers its own experiences from: a feature library
 * wires its own `ExperienceRegistry` (built with `new ExperienceRegistry()`, its own factories
 * registered on it — optionally seeded from this one, e.g.
 * `const registry = createDefaultExperienceRegistry(); registry.register('product-showcase', ...)`)
 * into `PlaycanvasRuntimeOptions.experienceRegistry` instead of extending this module — see this
 * library's README for the full extension story.
 */
export function createDefaultExperienceRegistry(): ExperienceRegistry {
  const registry = new ExperienceRegistry();
  registry.register(TECHNICAL_DEMO_EXPERIENCE_TYPE, createTechnicalDemoExperience);
  registry.register(REALISTIC_SHOWCASE_EXPERIENCE_TYPE, createRealisticShowcaseExperience);
  return registry;
}
