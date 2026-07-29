import { Location } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { BottomSheetService } from './bottom-sheet.service';
import { DialogService } from './dialog.service';
import { ModalService } from './modal.service';

/**
 * Small coordination layer for mobile navigation concerns that don't belong on any single
 * component:
 *  - `goBack()` wraps `Location` so every back affordance (`TopAppBarComponent`'s back button,
 *    a swipe-back gesture, …) reads from one place instead of each component injecting
 *    `Location` itself.
 *  - `hasOpenOverlay()` aggregates the Modal/Bottom Sheet/Dialog stacks into one signal, for
 *    components that need to react to "something is covering the screen right now" (e.g.
 *    suspending `PullToRefreshDirective` while a sheet is open).
 *
 * `BottomTabsComponent` does NOT route through this service for active-tab state — Angular's own
 * `routerLink`/`routerLinkActive` already solve that, so re-deriving it here would be duplicated
 * logic, not new infrastructure.
 */
@Injectable({ providedIn: 'root' })
export class MobileNavigationService {
  private readonly location = inject(Location);
  private readonly modalService = inject(ModalService);
  private readonly bottomSheetService = inject(BottomSheetService);
  private readonly dialogService = inject(DialogService);

  readonly hasOpenOverlay = computed(
    () =>
      this.modalService.entries().length > 0 ||
      this.bottomSheetService.entries().length > 0 ||
      this.dialogService.entries().length > 0,
  );

  goBack(): void {
    this.location.back();
  }
}
