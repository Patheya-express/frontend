import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorStateComponent, OrderStatusBadgeComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import type { MapPoint } from '@patheya-express-frontend/core';
import { CouponFacade } from '@patheya-express-frontend/coupons';
import { OrderDetailsFacade } from '../../facades/order-details.facade';
import { OrderStatusTimelineComponent } from '../../components/order-status-timeline/order-status-timeline.component';
import { LiveTrackingMapComponent } from '../../components/live-tracking-map/live-tracking-map.component';

@Component({
  selector: 'lib-order-details-page',
  standalone: true,
  imports: [
    RouterLink,
    SkeletonComponent,
    ErrorStateComponent,
    OrderStatusBadgeComponent,
    OrderStatusTimelineComponent,
    LiveTrackingMapComponent,
  ],
  templateUrl: './order-details-page.component.html',
  styleUrl: './order-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(OrderDetailsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly couponFacade = inject(CouponFacade);

  protected readonly order = this.facade.order;
  protected readonly restaurantName = this.facade.restaurantName;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly location = this.facade.location;
  protected readonly realtimeConnected = this.facade.realtimeConnected;
  protected readonly retryingPayment = signal(false);

  protected readonly destinationPoint = computed<MapPoint | null>(() => {
    const order = this.order();
    return order?.latitude != null && order?.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null;
  });

  protected readonly driverPoint = computed<MapPoint | null>(() => {
    const loc = this.location();
    return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
  });

  protected readonly showLiveMap = computed(() => {
    const order = this.order();
    return !!order && order.status === 'OUT_FOR_DELIVERY' && !!this.destinationPoint();
  });

  /**
   * `OrderResponseDto` only carries `couponId`, not the human-readable code — resolving a code
   * from an id would need the admin-only coupon lookup endpoint, which customers can't call. This
   * falls back to a same-session, client-remembered code (set at the moment of placing the
   * order); it won't resolve for orders viewed later or on a different device.
   */
  protected readonly couponCode = computed(() => {
    const order = this.order();
    return order?.couponId ? this.couponFacade.getCodeForOrder(order.id) : null;
  });

  private orderId = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('orderId');
      if (id) {
        this.orderId = id;
        this.facade.initialize(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.facade.dispose();
  }

  protected retry(): void {
    if (this.orderId) {
      void this.facade.retry(this.orderId);
    }
  }

  protected async retryPayment(): Promise<void> {
    if (!this.orderId) {
      return;
    }

    this.retryingPayment.set(true);
    await this.facade.retryPayment(this.orderId);
    this.retryingPayment.set(false);
  }
}
