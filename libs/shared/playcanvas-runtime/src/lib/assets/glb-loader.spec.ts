import { GlbLoader } from './glb-loader';
import type { ExperienceAssetReference } from '../types';

type LoadCallback = (err: string | null, asset?: MockAsset) => void;

class MockAsset {
  unload = jest.fn();
  resource: { instantiateRenderEntity: jest.Mock } | null = null;

  constructor(resourceEntity: unknown = { id: 'mock-entity' }) {
    this.resource = { instantiateRenderEntity: jest.fn(() => resourceEntity) };
  }
}

function createMockAssetRegistry() {
  let pendingCallback: LoadCallback | null = null;
  return {
    loadFromUrl: jest.fn((_url: string, _type: string, callback: LoadCallback) => {
      pendingCallback = callback;
    }),
    remove: jest.fn(),
    // test helpers, not part of the real AssetRegistry API
    resolvePending: (asset: MockAsset) => pendingCallback?.(null, asset),
    rejectPending: (message: string) => pendingCallback?.(message),
  };
}

const modelReference: ExperienceAssetReference = { id: 'sample-triangle', type: 'model', url: '/assets/models/sample-triangle.glb' };

describe('GlbLoader', () => {
  let registry: ReturnType<typeof createMockAssetRegistry>;
  let loader: GlbLoader;

  beforeEach(() => {
    registry = createMockAssetRegistry();
    loader = new GlbLoader(registry as never);
  });

  it('loads a valid "model" reference as a container asset and resolves with an instantiate() wrapper', async () => {
    const mockEntity = { id: 'entity-from-container' };
    const asset = new MockAsset(mockEntity);

    const pending = loader.load(modelReference);
    registry.resolvePending(asset);
    const result = await pending;

    expect(registry.loadFromUrl).toHaveBeenCalledWith(modelReference.url, 'container', expect.any(Function));
    expect(result.asset).toBe(asset);
    expect(result.instantiate()).toBe(mockEntity);
    expect(asset.resource?.instantiateRenderEntity).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately, without calling the registry, for a non-"model" reference', async () => {
    await expect(loader.load({ id: 'x', type: 'texture', url: '/x.png' })).rejects.toThrow(/only supports "model"/);
    expect(registry.loadFromUrl).not.toHaveBeenCalled();
  });

  it('rejects immediately, without calling the registry, for a reference with no url', async () => {
    await expect(loader.load({ id: 'x', type: 'model', url: '' })).rejects.toThrow(/no url/);
    expect(registry.loadFromUrl).not.toHaveBeenCalled();
  });

  it('rejects when PlayCanvas reports a load error', async () => {
    const pending = loader.load(modelReference);
    registry.rejectPending('404: not found');

    await expect(pending).rejects.toThrow('404: not found');
  });

  it('rejects with a clear message when PlayCanvas reports neither an error nor an asset', async () => {
    const pending = loader.load(modelReference);
    registry.rejectPending(null as unknown as string);

    await expect(pending).rejects.toThrow(/returned no asset/);
  });

  it('releaseAsset() unloads the asset and removes it from the registry', async () => {
    const asset = new MockAsset();
    const pending = loader.load(modelReference);
    registry.resolvePending(asset);
    const result = await pending;

    loader.releaseAsset(result);

    expect(asset.unload).toHaveBeenCalledTimes(1);
    expect(registry.remove).toHaveBeenCalledWith(asset);
  });

  it('a load already in flight when dispose() is called rejects once the callback fires, and releases the late-arriving asset instead of returning it', async () => {
    const asset = new MockAsset();
    const pending = loader.load(modelReference);

    loader.dispose();
    registry.resolvePending(asset); // PlayCanvas's callback still fires after disposal

    await expect(pending).rejects.toThrow(/was disposed before/);
    expect(asset.unload).toHaveBeenCalledTimes(1);
    expect(registry.remove).toHaveBeenCalledWith(asset);
  });

  it('a load started after dispose() also rejects once its callback fires, not just loads already in flight', async () => {
    loader.dispose();
    const asset = new MockAsset();

    const pending = loader.load(modelReference);
    registry.resolvePending(asset);

    await expect(pending).rejects.toThrow(/was disposed before/);
  });

  it('dispose() is safe to call more than once', () => {
    loader.dispose();
    expect(() => loader.dispose()).not.toThrow();
  });
});
