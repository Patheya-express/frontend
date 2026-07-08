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

  /**
   * Requests the browser's location (best-effort, silently falls back if denied/unavailable)
   * before loading home — nearby/recommended sections are only populated when we have
   * coordinates, per the customer/home contract.
   */
  async initialize(): Promise<void> {
    const position = await getCurrentPosition();
    await this.store.loadHome(position ? { lat: position.lat, lng: position.lng } : {});
  }

  retry(): Promise<void> {
    return this.initialize();
  }
}
