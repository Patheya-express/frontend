import { Injectable, inject } from '@angular/core';
import { CustomerHomeStore } from '../store/customer-home.store';

const GEOLOCATION_TIMEOUT_MS = 5000;

function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}

@Injectable({ providedIn: 'root' })
export class CustomerHomeFacade {
  private readonly store = inject(CustomerHomeStore);

  readonly home = this.store.home;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isEmpty = this.store.isEmpty;
  readonly hasLocation = this.store.hasLocation;

  readonly openNowRestaurants = this.store.openNowRestaurants;
  readonly openNowLoading = this.store.openNowLoading;
  readonly topRatedRestaurants = this.store.topRatedRestaurants;
  readonly topRatedLoading = this.store.topRatedLoading;
  readonly fastDeliveryRestaurants = this.store.fastDeliveryRestaurants;
  readonly fastDeliveryLoading = this.store.fastDeliveryLoading;

  readonly more = this.store.more;

  /**
   * Requests the browser's location (best-effort, silently falls back if denied/unavailable)
   * before loading home — nearby/recommended sections are only populated when we have
   * coordinates, per the customer/home contract.
   */
  async initialize(): Promise<void> {
    const position = await getCurrentPosition();
    await this.store.loadHome(position ? { lat: position.lat, lng: position.lng } : {});
  }

  /** Same as `initialize()` — re-requests location fresh rather than reusing a stale fix, since
   *  a retry/refresh is exactly the moment a "no location yet" state is most likely to have
   *  changed (the user just granted permission, or moved). Used by both the error-state retry
   *  action and pull-to-refresh. */
  retry(): Promise<void> {
    return this.initialize();
  }

  loadMoreRestaurants(): Promise<void> {
    return this.store.loadMore();
  }
}
