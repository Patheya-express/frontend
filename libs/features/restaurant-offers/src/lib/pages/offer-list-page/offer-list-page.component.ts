import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  PrimaryButtonComponent,
  SkeletonComponent,
  StatusChipComponent,
  type DataTableColumn,
} from '@patheya-express-frontend/ui';
import { RestaurantOffersFacade } from '../../facades/restaurant-offers.facade';
import { OfferFormComponent } from '../../components/offer-form/offer-form.component';

type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const COLUMNS: DataTableColumn[] = [
  { key: 'title', label: 'Offer' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'starts', label: 'Starts' },
  { key: 'ends', label: 'Ends' },
  { key: 'actions', label: '' },
];

const OFFER_TYPE_LABELS: Record<string, string> = {
  PERCENTAGE_OFF: 'Percentage Off',
  FLAT_OFF: 'Flat Off',
  FREE_DELIVERY: 'Free Delivery',
  BUY_ONE_GET_ONE: 'Buy One Get One',
  CASHBACK: 'Cashback',
  OTHER: 'Other',
};

@Component({
  selector: 'lib-offer-list-page',
  standalone: true,
  imports: [
    DataTableComponent,
    PaginationComponent,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    StatusChipComponent,
    ConfirmDialogComponent,
    PrimaryButtonComponent,
    OfferFormComponent,
  ],
  templateUrl: './offer-list-page.component.html',
  styleUrl: './offer-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferListPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantOffersFacade);
  protected readonly columns = COLUMNS;
  protected readonly filters = FILTERS;

  protected activeFilter: ActiveFilter = 'ALL';
  /** 'create' for a new offer, an offer to edit, or null when the form is closed. */
  protected formTarget: 'create' | OfferResponseDto | null = null;
  protected confirmDeleteId: string | null = null;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected typeLabel(type?: string): string {
    return type ? (OFFER_TYPE_LABELS[type] ?? type) : '—';
  }

  protected formatDate(value?: string): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  protected onFilterChange(filter: ActiveFilter): void {
    this.activeFilter = filter;
    this.facade.setActiveFilter(filter === 'ALL' ? null : filter === 'ACTIVE');
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected get isCreating(): boolean {
    return this.formTarget === 'create';
  }

  protected get editingOffer(): OfferResponseDto | null {
    return this.formTarget && this.formTarget !== 'create' ? this.formTarget : null;
  }

  protected openCreate(): void {
    this.formTarget = 'create';
  }

  protected openEdit(offer: OfferResponseDto): void {
    this.formTarget = offer;
  }

  protected closeForm(): void {
    this.formTarget = null;
  }

  protected isProcessing(offerId: string): boolean {
    return this.facade.processingId() === offerId;
  }

  protected toggleActive(offer: OfferResponseDto): void {
    if (this.isProcessing(offer.id)) {
      return;
    }
    void this.facade.setActive(offer.id, !offer.isActive);
  }

  protected requestDelete(offerId: string): void {
    this.confirmDeleteId = offerId;
  }

  protected cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  protected async confirmDelete(): Promise<void> {
    const offerId = this.confirmDeleteId;
    if (!offerId) {
      return;
    }
    this.confirmDeleteId = null;
    await this.facade.deleteOffer(offerId);
  }

  protected dismissActionError(): void {
    this.facade.dismissActionError();
  }
}
