import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface SwitcherOption {
  id: string;
  label: string;
}

/**
 * Purely presentational restaurant/branch selector for the partner shell header — the owning
 * app injects RestaurantContextService, resolves the option lists and current selection, and
 * handles what "switching" means (e.g. reloading the active page's data). No business logic or
 * SDK access here, matching the shared-ui component criteria.
 */
@Component({
  selector: 'lib-restaurant-branch-switcher',
  standalone: true,
  templateUrl: './restaurant-branch-switcher.component.html',
  styleUrl: './restaurant-branch-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantBranchSwitcherComponent {
  @Input() restaurants: SwitcherOption[] = [];
  @Input() branches: SwitcherOption[] = [];
  @Input() currentRestaurantId: string | null = null;
  @Input() currentBranchId: string | null = null;

  @Output() restaurantChange = new EventEmitter<string>();
  @Output() branchChange = new EventEmitter<string>();

  protected onRestaurantChange(event: Event): void {
    this.restaurantChange.emit((event.target as HTMLSelectElement).value);
  }

  protected onBranchChange(event: Event): void {
    this.branchChange.emit((event.target as HTMLSelectElement).value);
  }
}
