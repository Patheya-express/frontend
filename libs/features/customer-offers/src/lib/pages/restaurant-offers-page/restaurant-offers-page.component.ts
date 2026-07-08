import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CustomerOffersFacade } from '../../facades/customer-offers.facade';
import { OfferCardComponent } from '../../components/offer-card/offer-card.component';

@Component({
  selector: 'lib-restaurant-offers-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent, OfferCardComponent],
  templateUrl: './restaurant-offers-page.component.html',
  styleUrl: './restaurant-offers-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantOffersPageComponent implements OnInit {
  protected readonly facade = inject(CustomerOffersFacade);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(switchMap((params) => this.facade.loadRestaurantOffers(params.get('restaurantId') ?? '')))
      .subscribe();
  }

  protected get restaurantId(): string {
    return this.route.snapshot.paramMap.get('restaurantId') ?? '';
  }

  protected retry(): void {
    void this.facade.loadRestaurantOffers(this.restaurantId, this.facade.restaurantOffersPage());
  }

  protected onPageChange(page: number): void {
    void this.facade.loadRestaurantOffers(this.restaurantId, page);
  }
}
