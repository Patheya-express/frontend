import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { MapService, type LiveTrackingMapHandle, type MapPoint } from '@patheya-express-frontend/core';

@Component({
  selector: 'lib-live-tracking-map',
  standalone: true,
  templateUrl: './live-tracking-map.component.html',
  styleUrl: './live-tracking-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTrackingMapComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) destination!: MapPoint;
  @Input() driverLocation?: MapPoint;

  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLElement>;

  private readonly mapService = inject(MapService);
  private handle: LiveTrackingMapHandle | null = null;
  private initialized = false;

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (!this.initialized && this.destination) {
      this.initialized = true;

      this.handle = await this.mapService.createLiveTrackingMap(
        this.mapContainer.nativeElement,
        this.destination,
        this.driverLocation,
      );

      return;
    }

    if (this.handle && this.driverLocation && changes['driverLocation']) {
      this.handle.updateDriverPosition(this.driverLocation.lat, this.driverLocation.lng);
    }
  }

  ngOnDestroy(): void {
    this.handle?.destroy();
  }
}
