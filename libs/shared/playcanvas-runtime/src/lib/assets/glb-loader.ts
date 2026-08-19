import type * as pcNamespace from 'playcanvas';
import type { ExperienceAssetReference } from '../types';

/**
 * What {@link GlbLoader.load} resolves to — the loaded PlayCanvas `Asset` plus a way to turn it
 * into scene content. Kept separate from the `Asset` itself because a loaded container resource
 * can legitimately be instantiated more than once (e.g. the same model shown twice); `instantiate`
 * is a thin, correctly-typed wrapper over `ContainerResource.instantiateRenderEntity`, since
 * `Asset.resource`'s own type is the generic `object` (an `Asset` can hold any resource kind).
 */
export interface GlbLoadResult {
  readonly asset: pcNamespace.Asset;
  instantiate(options?: object): pcNamespace.Entity;
}

/**
 * Loads a `'model'`-typed {@link ExperienceAssetReference} as a GLB container through PlayCanvas's
 * own `AssetRegistry` — no custom GLB/GLTF parser, per the Phase 2.2 brief §2. Business-agnostic by
 * construction: the only inputs are a generic asset reference and PlayCanvas's own registry: no
 * Product/Restaurant/Menu/Cart/Order/Payment/Delivery/User/Merchant/Store reference anywhere.
 *
 * Does not own the `Application`/device (Phase 2.2 brief §3) — one `GlbLoader` is created per
 * `PlaycanvasRuntime` instance, scoped to that instance's own `AssetRegistry`, and disposed
 * alongside it; it never creates or destroys the `Application` itself.
 */
export class GlbLoader {
  private disposed = false;

  constructor(private readonly assets: pcNamespace.AssetRegistry) {}

  /**
   * Resolves once PlayCanvas finishes loading `reference.url` as a `'container'` asset, or rejects
   * on an invalid reference, a PlayCanvas load error, or this loader having been disposed before
   * the load settled (see {@link dispose}). Never throws synchronously and never leaves an
   * unhandled rejection — every failure path resolves the returned promise's rejection explicitly.
   */
  async load(reference: ExperienceAssetReference): Promise<GlbLoadResult> {
    if (reference.type !== 'model') {
      throw new Error(`GlbLoader only supports "model" asset references — got "${reference.type}" (asset id: "${reference.id}").`);
    }

    if (!reference.url) {
      throw new Error(`GlbLoader received a "model" asset reference ("${reference.id}") with no url.`);
    }

    return new Promise<GlbLoadResult>((resolve, reject) => {
      this.assets.loadFromUrl(reference.url, 'container', (err, asset) => {
        if (this.disposed) {
          // This loader was disposed while the request was in flight — release whatever PlayCanvas
          // handed back instead of returning it to a caller that has already torn down, mirroring
          // PlaycanvasRuntime.create()'s own destroyRequested discipline (Phase 2.2 brief §3/§7).
          if (asset) {
            asset.unload();
            this.assets.remove(asset);
          }
          reject(new Error(`GlbLoader was disposed before "${reference.id}" finished loading.`));
          return;
        }

        if (err || !asset) {
          reject(new Error(err ?? `GlbLoader: PlayCanvas returned no asset for "${reference.id}".`));
          return;
        }

        resolve({
          asset,
          instantiate: (options) => (asset.resource as pcNamespace.ContainerResource).instantiateRenderEntity(options),
        });
      });
    });
  }

  /**
   * Releases a previously loaded asset's GPU-resident resources (textures, meshes) and removes it
   * from the registry. Does not destroy any entity a caller instantiated from it via
   * {@link GlbLoadResult.instantiate} — that entity is scene content owned by whichever
   * `Experience` created it (see that interface's `dispose()`), destroyed the normal
   * `Entity.destroy()` way, same as any other entity under `ExperienceContext.root`.
   */
  releaseAsset(result: GlbLoadResult): void {
    result.asset.unload();
    this.assets.remove(result.asset);
  }

  /**
   * Marks this loader disposed. Any {@link load} call already in flight discards its result once
   * PlayCanvas's callback fires, instead of resolving it — this loader's own defense against
   * "disposal during loading" (Phase 2.2 brief §3/§6/§7), independent of whether the caller that
   * requested the load remembered to check anything itself. Idempotent.
   */
  dispose(): void {
    this.disposed = true;
  }
}
