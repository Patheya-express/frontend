import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ExperienceConfig, RuntimeStatus } from '@patheya-express-frontend/playcanvas-ui';
import { PlaycanvasSceneComponent } from '@patheya-express-frontend/playcanvas-ui';
import { TECHNICAL_DEMO_EXPERIENCE_TYPE } from '@patheya-express-frontend/playcanvas-runtime';

/**
 * Internal, non-product technical validation surface for the PlayCanvas foundation (Phase 1 brief
 * §19/§30/§31) — not linked from any customer-facing navigation. Its only purpose is proving the
 * create → render → resize → lifecycle → dispose path works end to end in a real browser and
 * inside the Capacitor Android shell, ahead of any actual commerce experience being built on top
 * of `@patheya-express-frontend/playcanvas-ui`/`playcanvas-runtime`.
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
  };

  protected onStatusChange(status: RuntimeStatus): void {
    // Internal diagnostic page only, never shipped as a customer-facing route — console visibility
    // is the point during manual/Android validation of the create → render → dispose lifecycle.
    console.info('[playcanvas-poc] runtime status:', status);
  }
}
