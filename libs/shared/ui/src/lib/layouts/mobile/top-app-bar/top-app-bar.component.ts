import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { IconButtonComponent } from '../../../buttons/icon-button.component';
import { MobileNavigationService } from '../../../services/mobile-navigation.service';

/**
 * Top app bar: optional back button (routes through `MobileNavigationService.goBack()`, the
 * single shared back-navigation entry point — see that service's doc comment), title, and
 * leading/trailing action slots. Safe-area-top aware.
 *
 * @example
 * <mobile-top-app-bar title="Order #4821" [showBackButton]="true">
 *   <lib-icon-button mobileTrailing ariaLabel="Share" (buttonClick)="share()">↗</lib-icon-button>
 * </mobile-top-app-bar>
 */
@Component({
  selector: 'mobile-top-app-bar',
  standalone: true,
  imports: [IconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'banner',
    class: 'safe-area-top',
  },
  template: `
    @if (showBackButton()) {
      <lib-icon-button ariaLabel="Back" (buttonClick)="onBack()">‹</lib-icon-button>
    } @else {
      <ng-content select="[mobileLeading]" />
    }
    <h1 class="mobile-top-app-bar__title">{{ title() }}</h1>
    <div class="mobile-top-app-bar__actions"><ng-content select="[mobileTrailing]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--touch-target-large);
      padding: 0 var(--space-2);
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      z-index: var(--z-index-top-app-bar);
    }

    .mobile-top-app-bar__title {
      flex: 1;
      margin: 0;
      padding-inline-start: var(--space-2);
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-top-app-bar__actions {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
  `,
})
export class TopAppBarComponent {
  readonly title = input('');
  readonly showBackButton = input(false);
  readonly backClick = output<void>();

  private readonly navigationService = inject(MobileNavigationService);

  onBack(): void {
    this.backClick.emit();
    this.navigationService.goBack();
  }
}
