import { Injectable, inject } from '@angular/core';
import { CustomerOffersStore } from '../store/customer-offers.store';
import type { GetOffersParams } from '../services/customer-offers.service';

type OfferType = NonNullable<GetOffersParams['type']>;

@Injectable({ providedIn: 'root' })
export class CustomerOffersFacade {
  private readonly store = inject(CustomerOffersStore);

  readonly offers = this.store.offers;
  readonly total = this.store.total;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly search = this.store.search;
  readonly typeFilter = this.store.typeFilter;

  readonly featured = this.store.featured;
  readonly featuredLoading = this.store.featuredLoading;

  readonly home = this.store.home;
  readonly homeLoading = this.store.homeLoading;

  readonly restaurantOffers = this.store.restaurantOffers;
  readonly restaurantOffersTotal = this.store.restaurantOffersTotal;
  readonly restaurantOffersPage = this.store.restaurantOffersPage;
  readonly restaurantOffersTotalPages = this.store.restaurantOffersTotalPages;
  readonly restaurantOffersLoading = this.store.restaurantOffersLoading;
  readonly restaurantOffersError = this.store.restaurantOffersError;

  readonly selectedOffer = this.store.selectedOffer;
  readonly selectedOfferLoading = this.store.selectedOfferLoading;
  readonly selectedOfferError = this.store.selectedOfferError;

  loadOffers(page?: number): Promise<void> {
    return this.store.loadOffers(page);
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setTypeFilter(type: OfferType | undefined): void {
    this.store.setTypeFilter(type);
  }

  clearFilters(): void {
    this.store.clearFilters();
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  loadFeatured(limit?: number): Promise<void> {
    return this.store.loadFeatured(limit);
  }

  loadHome(limit?: number): Promise<void> {
    return this.store.loadHome(limit);
  }

  loadRestaurantOffers(restaurantId: string, page?: number): Promise<void> {
    return this.store.loadRestaurantOffers(restaurantId, page);
  }

  loadOfferById(id: string): Promise<void> {
    return this.store.loadOfferById(id);
  }
}
