import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Generic titled content section (a home screen's "Popular near you", a settings screen's
 * grouped fields, …) — optional title/subtitle and an optional trailing action slot
 * (e.g. "See all").
 *
 * @example
 * <mobile-section title="Popular near you">
 *   <button mobileSectionAction (click)="seeAll()">See all</button>
 *   …
 * </mobile-section>
 */
@Component({
  selector: 'mobile-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (title() || subtitle()) {
      <div class="mobile-section__header">
        <div class="mobile-section__heading">
          @if (title()) {
            <h2 class="mobile-section__title">{{ title() }}</h2>
          }
          @if (subtitle()) {
            <p class="mobile-section__subtitle">{{ subtitle() }}</p>
          }
        </div>
        <div class="mobile-section__action"><ng-content select="[mobileSectionAction]" /></div>
      </div>
    }
    <div class="mobile-section__content"><ng-content /></div>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--space-6);
    }

    .mobile-section__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: 0 var(--space-4);
      margin-bottom: var(--space-3);
    }

    .mobile-section__title {
      margin: 0;
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text);
    }

    .mobile-section__subtitle {
      margin: 2px 0 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
  `,
})
export class SectionComponent {
  readonly title = input<string | undefined>(undefined);
  readonly subtitle = input<string | undefined>(undefined);
}
