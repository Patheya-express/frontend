import { Injectable, inject } from '@angular/core';
import { MapPickerStore } from '../store/map-picker.store';
import type { AddressSearchResult, MapLatLng, PickedLocation } from '../models/map-picker.models';

/** Component-scoped — provided alongside `MapPickerStore` in `MapPickerComponent.providers`. */
@Injectable()
export class MapPickerFacade {
  private readonly store = inject(MapPickerStore);

  readonly mapReady = this.store.mapReady;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly markerPosition = this.store.markerPosition;
  readonly addressPreview = this.store.addressPreview;
  readonly locationSource = this.store.locationSource;
  readonly searchQuery = this.store.searchQuery;
  readonly searchResults = this.store.searchResults;
  readonly searching = this.store.searching;
  readonly providerName = this.store.providerName;
  readonly isProviderConfigured = this.store.isProviderConfigured;
  readonly currentLocation = this.store.currentLocation;

  initialize(container: HTMLElement, initialPosition?: MapLatLng): Promise<void> {
    return this.store.initialize(container, initialPosition);
  }

  search(query: string): void {
    this.store.search(query);
  }

  clearSearch(): void {
    this.store.clearSearch();
  }

  selectSearchResult(result: AddressSearchResult): Promise<void> {
    return this.store.selectSearchResult(result);
  }

  useCurrentLocation(): Promise<void> {
    return this.store.useCurrentLocation();
  }

  recenter(): void {
    this.store.recenter();
  }

  /** Snapshot helper for parent forms that just want the final value on submit, without
   *  subscribing to the `currentLocation` signal themselves. */
  getPickedLocation(): PickedLocation | null {
    return this.currentLocation();
  }

  destroy(): void {
    this.store.destroy();
  }
}
