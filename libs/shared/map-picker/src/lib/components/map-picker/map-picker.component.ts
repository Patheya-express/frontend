import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapPickerFacade } from '../../facades/map-picker.facade';
import { MapPickerStore } from '../../store/map-picker.store';
import type { AddressSearchResult, MapLatLng, PickedLocation } from '../../models/map-picker.models';

/**
 * Reusable, provider-agnostic interactive location picker — Component -> Facade -> Store ->
 * Service -> AddressProvider (see PADK map-picker doc). Never references a concrete map SDK
 * directly; everything goes through the injected `MapPickerFacade`.
 *
 * `MapPickerStore`/`MapPickerFacade` are provided here (component-scoped, not root) so every
 * embedding of this component gets its own independent map/marker/address state, and Angular
 * calls their `ngOnDestroy` automatically when this component is destroyed.
 */
@Component({
  selector: 'lib-map-picker',
  standalone: true,
  imports: [FormsModule],
  providers: [MapPickerStore, MapPickerFacade],
  templateUrl: './map-picker.component.html',
  styleUrl: './map-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPickerComponent implements OnInit, OnDestroy {
  /** Prefill the marker (e.g. editing an existing saved address/branch). Omit for a fresh pick. */
  @Input() initialPosition?: MapLatLng;
  @Input() height = '360px';

  /** Fires on every synchronized change (search selection, click, drag, current location) —
   *  parent forms should treat the latest emission as the current draft value, not just a
   *  one-time "save" signal. */
  @Output() readonly locationChange = new EventEmitter<PickedLocation>();

  @ViewChild('mapContainer', { static: true }) private readonly mapContainerRef!: ElementRef<HTMLDivElement>;

  protected readonly facade = inject(MapPickerFacade);

  constructor() {
    effect(() => {
      const location = this.facade.currentLocation();
      if (location) {
        this.locationChange.emit(location);
      }
    });
  }

  ngOnInit(): void {
    void this.facade.initialize(this.mapContainerRef.nativeElement, this.initialPosition);
  }

  ngOnDestroy(): void {
    this.facade.destroy();
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.facade.search(value);
  }

  protected onSelectResult(result: AddressSearchResult): void {
    void this.facade.selectSearchResult(result);
  }

  protected onUseCurrentLocation(): void {
    void this.facade.useCurrentLocation();
  }

  protected onRecenter(): void {
    this.facade.recenter();
  }
}
