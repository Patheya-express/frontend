import { Injectable } from '@angular/core';
import { OverlayStackService } from './overlay-stack.service';

/**
 * Opens a bottom-anchored sheet (the mobile-native equivalent of a dropdown/popover/small modal)
 * — pair with `BottomSheetHostComponent` placed once near the app root. Swipe-down-to-dismiss is
 * handled by `BottomSheetComponent` itself (via `SwipeDirective`) when `dismissible` isn't false.
 *
 * @example
 * const ref = this.bottomSheetService.open(FilterOptionsComponent, { data: { filters } });
 * const selectedFilters = await ref.afterClosed();
 */
@Injectable({ providedIn: 'root' })
export class BottomSheetService<TData = unknown, TResult = unknown> extends OverlayStackService<
  TData,
  TResult
> {}
