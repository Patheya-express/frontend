import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { OrderDetailsFacade } from '../../facades/order-details.facade';

@Component({
  selector: 'lib-order-details-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, ErrorStateComponent],
  templateUrl: './order-details-page.component.html',
  styleUrl: './order-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsPageComponent implements OnInit {
  private readonly facade = inject(OrderDetailsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly order = this.facade.order;
  protected readonly restaurantName = this.facade.restaurantName;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  private orderId = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('orderId');
      if (id) {
        this.orderId = id;
        void this.facade.loadOrder(id);
      }
    });
  }

  protected retry(): void {
    if (this.orderId) {
      void this.facade.loadOrder(this.orderId);
    }
  }
}
