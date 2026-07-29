import { Injectable, inject } from '@angular/core';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import type { OfferFormValue } from '../services/restaurant-offers.service';
import { RestaurantOffersStore } from '../store/restaurant-offers.store';

@Injectable({ providedIn: 'root' })
export class RestaurantOffersFacade {
  private readonly store = inject(RestaurantOffersStore);

  readonly offers = this.store.offers;
  readonly pagination = this.store.pagination;
  readonly filters = this.store.filters;
  readonly selectedOffer = this.store.selectedOffer;
  readonly loading = this.store.loading;
  readonly saving = this.store.saving;
  readonly processingId = this.store.processingId;
  readonly error = this.store.error;
  readonly actionError = this.store.actionError;
  readonly validationErrors = this.store.validationErrors;

  initialize(): Promise<void> {
    return this.store.loadOffers();
  }

  refresh(): Promise<void> {
    return this.store.loadOffers();
  }

  setActiveFilter(isActive: boolean | null): void {
    this.store.setActiveFilter(isActive);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectOffer(offer: OfferResponseDto | null): void {
    this.store.selectOffer(offer);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }

  dismissValidationErrors(): void {
    this.store.dismissValidationErrors();
  }

  createOffer(value: OfferFormValue): Promise<boolean> {
    return this.store.createOffer(value);
  }

  updateOffer(offerId: string, value: OfferFormValue): Promise<boolean> {
    return this.store.updateOffer(offerId, value);
  }

  deleteOffer(offerId: string): Promise<boolean> {
    return this.store.deleteOffer(offerId);
  }

  setActive(offerId: string, isActive: boolean): Promise<boolean> {
    return this.store.setActive(offerId, isActive);
  }
}
