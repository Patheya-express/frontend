import { ExperienceRegistry } from './experience-registry';
import type { Experience, ExperienceFactory } from './experience';

function fakeFactory(): ExperienceFactory {
  const experience: Experience = { dispose: jest.fn() };
  return jest.fn(() => experience) as ExperienceFactory;
}

describe('ExperienceRegistry', () => {
  it('resolves a registered factory by its exact experienceType', () => {
    const registry = new ExperienceRegistry();
    const factory = fakeFactory();

    registry.register('technical-demo', factory);

    expect(registry.resolve('technical-demo')).toBe(factory);
  });

  it('reports whether a type is registered via has()', () => {
    const registry = new ExperienceRegistry();
    registry.register('technical-demo', fakeFactory());

    expect(registry.has('technical-demo')).toBe(true);
    expect(registry.has('unregistered')).toBe(false);
  });

  it('throws a clear, deterministic error for an unknown experienceType', () => {
    const registry = new ExperienceRegistry();

    expect(() => registry.resolve('nonexistent')).toThrow(/No experience factory is registered for "nonexistent"/);
  });

  it('rejects a duplicate registration by default', () => {
    const registry = new ExperienceRegistry();
    registry.register('technical-demo', fakeFactory());

    expect(() => registry.register('technical-demo', fakeFactory())).toThrow(
      /already registered for "technical-demo"/,
    );
  });

  it('does not replace the original factory when a duplicate registration is rejected', () => {
    const registry = new ExperienceRegistry();
    const original = fakeFactory();
    registry.register('technical-demo', original);

    expect(() => registry.register('technical-demo', fakeFactory())).toThrow();

    expect(registry.resolve('technical-demo')).toBe(original);
  });

  it('allows a duplicate registration to replace the original when allowOverride is set', () => {
    const registry = new ExperienceRegistry();
    registry.register('technical-demo', fakeFactory());
    const replacement = fakeFactory();

    registry.register('technical-demo', replacement, { allowOverride: true });

    expect(registry.resolve('technical-demo')).toBe(replacement);
  });

  it('keeps separate registry instances fully isolated from each other', () => {
    const registryA = new ExperienceRegistry();
    const registryB = new ExperienceRegistry();
    registryA.register('only-on-a', fakeFactory());

    expect(registryA.has('only-on-a')).toBe(true);
    expect(registryB.has('only-on-a')).toBe(false);
    expect(() => registryB.resolve('only-on-a')).toThrow();
  });
});
