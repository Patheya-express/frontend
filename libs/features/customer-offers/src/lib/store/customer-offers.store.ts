import { Injectable, inject, signal } from '@angular/core';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import { CustomerOffersService, type GetOffersParams } from '../services/customer-offers.service';

const PAGE_SIZE = 20;

type OfferType = NonNullable<GetOffersParams['type']>;

@Injectable({ providedIn: 'root' })
export class CustomerOffersStore {
  private readonly offersService = inject(CustomerOffersService);

  private readonly _offers = signal<OfferResponseDto[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _search = signal('');
  private readonly _type = signal<OfferType | undefined>(undefined);

  private readonly _featured = signal<OfferResponseDto[]>([]);
  private readonly _featuredLoading = signal(false);

  private readonly _home = signal<OfferResponseDto[]>([]);
  private readonly _homeLoading = signal(false);

  private readonly _restaurantOffers = signal<OfferResponseDto[]>([]);
  private readonly _restaurantOffersTotal = signal(0);
  private readonly _restaurantOffersPage = signal(1);
  private readonly _restaurantOffersTotalPages = signal(1);
  private readonly _restaurantOffersLoading = signal(false);
  private readonly _restaurantOffersError = signal<string | null>(null);

  private readonly _selectedOffer = signal<OfferResponseDto | null>(null);
  private readonly _selectedOfferLoading = signal(false);
  private readonly _selectedOfferError = signal<string | null>(null);

  readonly offers = this._offers.asReadonly();
  readonly total = this._total.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly search = this._search.asReadonly();
  readonly typeFilter = this._type.asReadonly();

  readonly featured = this._featured.asReadonly();
  readonly featuredLoading = this._featuredLoading.asReadonly();

  readonly home = this._home.asReadonly();
  readonly homeLoading = this._homeLoading.asReadonly();

  readonly restaurantOffers = this._restaurantOffers.asReadonly();
  readonly restaurantOffersTotal = this._restaurantOffersTotal.asReadonly();
  readonly restaurantOffersPage = this._restaurantOffersPage.asReadonly();
  readonly restaurantOffersTotalPages = this._restaurantOffersTotalPages.asReadonly();
  readonly restaurantOffersLoading = this._restaurantOffersLoading.asReadonly();
  readonly restaurantOffersError = this._restaurantOffersError.asReadonly();

  readonly selectedOffer = this._selectedOffer.asReadonly();
  readonly selectedOfferLoading = this._selectedOfferLoading.asReadonly();
  readonly selectedOfferError = this._selectedOfferError.asReadonly();

  async loadOffers(page = 1): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await this.offersService.getOffers({
        page,
        limit: PAGE_SIZE,
        search: this._search() || undefined,
        type: this._type(),
      });

      this._offers.set(result.items);
      this._total.set(result.total);
      this._page.set(result.page);
      this._totalPages.set(result.totalPages);
    } catch {
      this._error.set('Unable to load offers. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._search.set(search);
    void this.loadOffers(1);
  }

  setTypeFilter(type: OfferType | undefined): void {
    this._type.set(type);
    void this.loadOffers(1);
  }

  clearFilters(): void {
    this._search.set('');
    this._type.set(undefined);
    void this.loadOffers(1);
  }

  setPage(page: number): void {
    void this.loadOffers(page);
  }

  async loadFeatured(limit?: number): Promise<void> {
    this._featuredLoading.set(true);

    try {
      this._featured.set(await this.offersService.getFeatured(limit));
    } finally {
      this._featuredLoading.set(false);
    }
  }

  async loadHome(limit?: number): Promise<void> {
    this._homeLoading.set(true);

    try {
      this._home.set(await this.offersService.getHome(limit));
    } finally {
      this._homeLoading.set(false);
    }
  }

  async loadRestaurantOffers(restaurantId: string, page = 1): Promise<void> {
    this._restaurantOffersLoading.set(true);
    this._restaurantOffersError.set(null);

    try {
      const result = await this.offersService.getByRestaurant(restaurantId, {
        page,
        limit: PAGE_SIZE,
      });

      this._restaurantOffers.set(result.items);
      this._restaurantOffersTotal.set(result.total);
      this._restaurantOffersPage.set(result.page);
      this._restaurantOffersTotalPages.set(result.totalPages);
    } catch {
      this._restaurantOffersError.set('Unable to load offers for this restaurant. Please try again.');
    } finally {
      this._restaurantOffersLoading.set(false);
    }
  }

  async loadOfferById(id: string): Promise<void> {
    this._selectedOfferLoading.set(true);
    this._selectedOfferError.set(null);

    try {
      this._selectedOffer.set(await this.offersService.getOfferById(id));
    } catch {
      this._selectedOfferError.set('This offer is no longer available.');
    } finally {
      this._selectedOfferLoading.set(false);
    }
  }
}
