import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Generic tappable row: leading slot (icon/avatar), title/subtitle, trailing slot (chevron,
 * value, switch, …) — the base building block for settings screens, address lists, notification
 * lists, and similar. `RippleDirective` isn't baked in automatically (not every list is tappable
 * — e.g. a read-only info row) — add `mobileRipple` yourself when `interactive` is true.
 *
 * @example
 * <lib-list-tile interactive (tileClick)="openAddress(address.id)">
 *   <span mobileLeading>📍</span>
 *   <span mobileTitle>Home</span>
 *   <span mobileSubtitle>221B Baker Street</span>
 *   <span mobileTrailing>›</span>
 * </lib-list-tile>
 */
@Component({
  selector: 'lib-list-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': "interactive() ? 'button' : null",
    '[attr.tabindex]': "interactive() ? '0' : null",
    '[class.mobile-list-tile--interactive]': 'interactive()',
    '(click)': 'onActivate()',
    '(keydown.enter)': 'onActivate()',
  },
  template: `
    <span class="mobile-list-tile__leading"><ng-content select="[mobileLeading]" /></span>
    <span class="mobile-list-tile__text">
      <span class="mobile-list-tile__title"><ng-content select="[mobileTitle]" /></span>
      <span class="mobile-list-tile__subtitle"><ng-content select="[mobileSubtitle]" /></span>
    </span>
    <span class="mobile-list-tile__trailing"><ng-content select="[mobileTrailing]" /></span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: var(--touch-target-large);
      padding: var(--space-2) var(--space-4);
    }

    :host(.mobile-list-tile--interactive) {
      cursor: pointer;
    }

    :host(.mobile-list-tile--interactive:focus-visible) {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    .mobile-list-tile__leading:empty,
    .mobile-list-tile__trailing:empty {
      display: none;
    }

    .mobile-list-tile__text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .mobile-list-tile__title {
      color: var(--color-text);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-list-tile__subtitle:not(:empty) {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class ListTileComponent {
  readonly interactive = input(false);
  readonly tileClick = output<void>();

  onActivate(): void {
    if (this.interactive()) {
      this.tileClick.emit();
    }
  }
}
