import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgressIndicatorComponent, NetworkStatusService } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { AppBootstrapStateService } from '../../state/app-bootstrap-state.service';
import { HAS_SEEN_WELCOME_KEY } from '../../state/welcome-storage';
import { SPLASH_INITIALIZERS } from '../../tokens/splash-initializers.token';

const QUOTE_ROTATION_MS = 4000;

/**
 * First screen of every session: session restoration itself is already synchronous
 * (`AuthFacade.initialize()` runs in `provideAppInitializer`, before this component even exists —
 * by the time this renders, `AuthFacade.isAuthenticated()` already reflects any stored session).
 * What this screen actually waits on and shows a loading state for is app-specific *async*
 * startup work registered via `SPLASH_INITIALIZERS` (e.g. restoring a signed-in customer's cart).
 * A failure there is swallowed, not fatal — offline or a slow backend delays entry, never blocks
 * it outright; the screen that actually needs that data shows its own error/retry state.
 */
@Component({
  selector: 'lib-splash-page',
  standalone: true,
  imports: [ProgressIndicatorComponent],
  templateUrl: './splash-page.component.html',
  styleUrl: './splash-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authFacade = inject(AuthFacade);
  private readonly bootstrapState = inject(AppBootstrapStateService);
  private readonly initializers = inject(SPLASH_INITIALIZERS);
  private readonly networkStatus = inject(NetworkStatusService);

  protected readonly brandName = this.route.snapshot.data['brandName'] ?? 'Patheya Express';
  protected readonly isOffline = this.networkStatus.isOffline;

  /** Rotating tagline quotes — opt-in via route `data.quotes`, defaulting to none. Deliberately
   *  not hardcoded here: this component is shared across all four apps (customer/restaurant/
   *  delivery/admin), and food-delivery-themed copy ("Every meal tells a story") only makes sense
   *  for the customer-facing splash — see apps/customer-app/src/app/app.routes.ts's `splash`
   *  route for where it's actually supplied. */
  protected readonly quotes: string[] = this.route.snapshot.data['quotes'] ?? [];
  protected readonly currentQuoteIndex = signal(0);
  private quoteInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    void this.runInitialization();

    if (this.quotes.length > 1) {
      this.quoteInterval = setInterval(() => {
        this.currentQuoteIndex.update((i) => (i + 1) % this.quotes.length);
      }, QUOTE_ROTATION_MS);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.quoteInterval);
  }

  private async runInitialization(): Promise<void> {
    try {
      await Promise.all(this.initializers.map((run) => run()));
    } catch {
      // Non-fatal by design — see class doc comment.
    } finally {
      this.bootstrapState.markSplashCompleted();

      const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
      const targetUrl = redirectTo && redirectTo !== '/splash' ? redirectTo : this.resolveDefaultTarget();

      await this.router.navigateByUrl(targetUrl);
    }
  }

  /** No explicit `redirectTo` — this was a cold app launch, not a resume-after-splash-redirect.
   *  Guests and returning signed-in users both land on the existing public home route
   *  (unchanged from today's behavior); first-ever launch goes to `/welcome` instead. */
  private resolveDefaultTarget(): string {
    if (this.authFacade.isAuthenticated()) {
      return '/';
    }

    const hasSeenWelcome = localStorage.getItem(HAS_SEEN_WELCOME_KEY) === 'true';
    return hasSeenWelcome ? '/' : '/welcome';
  }
}
