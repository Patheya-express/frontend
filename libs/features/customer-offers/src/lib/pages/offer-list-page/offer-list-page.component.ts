import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { EmptyStateComponent, ErrorStateComponent, PaginationComponent, SearchInputComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CustomerOffersFacade } from '../../facades/customer-offers.facade';
import { OfferCardComponent } from '../../components/offer-card/offer-card.component';
import type { GetOffersParams } from '../../services/customer-offers.service';

type OfferType = NonNullable<GetOffersParams['type']>;

const TYPE_OPTIONS: { value: OfferType; label: string }[] = [
  { value: 'PERCENTAGE_OFF', label: 'Percentage off' },
  { value: 'FLAT_OFF', label: 'Flat off' },
  { value: 'FREE_DELIVERY', label: 'Free delivery' },
  { value: 'BUY_ONE_GET_ONE', label: 'Buy one get one' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'lib-offer-list-page',
  standalone: true,
  imports: [SearchInputComponent, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent, OfferCardComponent],
  templateUrl: './offer-list-page.component.html',
  styleUrl: './offer-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferListPageComponent implements OnInit {
  protected readonly facade = inject(CustomerOffersFacade);
  protected readonly typeOptions = TYPE_OPTIONS;

  ngOnInit(): void {
    void this.facade.loadOffers();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onTypeChange(value: string): void {
    this.facade.setTypeFilter(value ? (value as OfferType) : undefined);
  }

  protected clearFilters(): void {
    this.facade.clearFilters();
  }

  protected retry(): void {
    void this.facade.loadOffers(this.facade.page());
  }

  protected onPageChange(page: number): void {
    void this.facade.loadOffers(page);
  }
}
