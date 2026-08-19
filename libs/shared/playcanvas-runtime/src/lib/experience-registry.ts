import type { ExperienceFactory } from './experience';

export interface ExperienceRegistrationOptions {
  /** Replace an already-registered factory for the same `experienceType` instead of throwing —
   *  intended for tests/deliberate replacement, not routine registration (see the class doc
   *  comment's default-safety rationale). */
  readonly allowOverride?: boolean;
}

/**
 * Resolves a plain string `experienceType` (the value `ExperienceConfig.experienceType` carries)
 * to the {@link ExperienceFactory} that knows how to build it. Deliberately instantiable, not a
 * module-level singleton — Phase 2.1's brief explicitly calls for "no global mutable singleton
 * unless the existing architecture explicitly requires it," and nothing here does: each
 * `PlaycanvasRuntime` either receives a registry a caller constructed (a future feature wiring in
 * its own business experiences) or lazily builds its own private default instance (see
 * `createDefaultExperienceRegistry`) — never a shared object multiple unrelated runtimes mutate.
 *
 * Registration is rejection-by-default on a collision (not a silent overwrite): two features
 * accidentally registering the same `experienceType` is a real bug worth failing loudly on,
 * exactly the "deterministic resolution" + "clear error" behavior the Phase 2.1 brief §3 asks for.
 */
export class ExperienceRegistry {
  private readonly factories = new Map<string, ExperienceFactory>();

  register(experienceType: string, factory: ExperienceFactory, options?: ExperienceRegistrationOptions): void {
    if (this.factories.has(experienceType) && !options?.allowOverride) {
      throw new Error(
        `An experience factory is already registered for "${experienceType}". Pass { allowOverride: true } if replacing it is intentional.`,
      );
    }

    this.factories.set(experienceType, factory);
  }

  resolve(experienceType: string): ExperienceFactory {
    const factory = this.factories.get(experienceType);
    if (!factory) {
      throw new Error(`No experience factory is registered for "${experienceType}".`);
    }

    return factory;
  }

  has(experienceType: string): boolean {
    return this.factories.has(experienceType);
  }
}
