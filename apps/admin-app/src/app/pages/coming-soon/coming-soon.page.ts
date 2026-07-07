import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EmptyStateComponent } from '@patheya-express-frontend/ui';

/**
 * Shared placeholder for admin routes whose management pages haven't been built yet
 * (Users, Restaurants, Orders, Delivery, Payments, Audit Logs). Routing exists now so
 * Quick Actions and shell navigation have real destinations; each route supplies its own
 * title/message via route data rather than duplicating this page per section.
 */
@Component({
  selector: 'app-coming-soon-page',
  standalone: true,
  imports: [EmptyStateComponent],
  templateUrl: './coming-soon.page.html',
  styleUrl: './coming-soon.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly title = (this.route.snapshot.data['title'] as string | undefined) ?? 'Coming Soon';
  protected readonly message =
    (this.route.snapshot.data['message'] as string | undefined) ??
    'This section is not available yet. Check back in a future release.';

  protected backToDashboard(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
