import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ExperienceConfig, RuntimeStatus } from '@patheya-express-frontend/playcanvas-ui';
import { PlaycanvasSceneComponent } from '@patheya-express-frontend/playcanvas-ui';
import { REALISTIC_SHOWCASE_EXPERIENCE_TYPE, TECHNICAL_DEMO_EXPERIENCE_TYPE } from '@patheya-express-frontend/playcanvas-runtime';

/**
 * Internal, non-product technical validation surface for the PlayCanvas foundation (Phase 1 brief
 * §19/§30/§31) — not linked from any customer-facing navigation. Its only purpose is proving the
 * create → render → resize → lifecycle → dispose path works end to end in a real browser and
 * inside the Capacitor Android shell, ahead of any actual commerce experience being built on top
 * of `@patheya-express-frontend/playcanvas-ui`/`playcanvas-runtime`. As of Phase 2.2, it also
 * references one local sample GLB (`public/assets/models/sample-triangle.glb` — a hand-built,
 * ~470-byte single-triangle mesh, not a real asset) to prove the
 * `ExperienceAssetReference → GlbLoader → PlayCanvas Asset` path renders inside this same surface.
 * As of Phase 2.3, it also references a second local sample GLB
 * (`public/assets/models/sample-textured.glb` — a hand-built, ~1.2KB textured quad: geometry + a
 * glTF material + an embedded base-color PNG texture) to prove the same pipeline handles a
 * material-bearing GLB with no different code path — both assets are ordinary `type: 'model'`
 * references, loaded side by side. As of Phase 2.4, a second, independent scene below the
 * technical-demo one exercises the `realistic-showcase` experience: one realistic, license-clean,
 * PBR model (`flight-helmet.glb` — see `public/assets/models/flight-helmet.LICENSE.md` for
 * provenance) with an interactive orbit camera, proving a second `PlaycanvasRuntime` instance can
 * run concurrently alongside the first on the same page without conflict (Phase 2.4 brief §11).
 * `debug: true` turns on this experience's dev-only performance logging (§9) for this internal
 * page only — never set from a customer-facing route.
 */
@Component({
  selector: 'app-playcanvas-poc-page',
  standalone: true,
  imports: [PlaycanvasSceneComponent],
  templateUrl: './playcanvas-poc-page.component.html',
  styleUrl: './playcanvas-poc-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaycanvasPocPageComponent {
  protected readonly demoConfig: ExperienceConfig = {
    experienceType: TECHNICAL_DEMO_EXPERIENCE_TYPE,
    quality: 'medium',
    reducedMotion: false,
    assets: [
      { id: 'sample-triangle', type: 'model', url: '/assets/models/sample-triangle.glb' },
      { id: 'sample-textured', type: 'model', url: '/assets/models/sample-textured.glb' },
    ],
  };

  protected readonly realisticShowcaseConfig: ExperienceConfig = {
    experienceType: REALISTIC_SHOWCASE_EXPERIENCE_TYPE,
    quality: 'medium',
    reducedMotion: false,
    assets: [{ id: 'flight-helmet', type: 'model', url: '/assets/models/flight-helmet.glb' }],
    settings: { debug: true },
  };

  protected onStatusChange(status: RuntimeStatus): void {
    // Internal diagnostic page only, never shipped as a customer-facing route — console visibility
    // is the point during manual/Android validation of the create → render → dispose lifecycle.
    console.info('[playcanvas-poc] technical-demo runtime status:', status);
  }

  protected onRealisticShowcaseStatusChange(status: RuntimeStatus): void {
    console.info('[playcanvas-poc] realistic-showcase runtime status:', status);
  }
}
