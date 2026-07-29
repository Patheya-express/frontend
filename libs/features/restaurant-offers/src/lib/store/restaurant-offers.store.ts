import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantOffersService, type OfferFormValue } from '../services/restaurant-offers.service';

export interface OffersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OffersFilters {
  /** null = both enabled and disabled offers. */
  isActive: boolean | null;
}

const DEFAULT_PAGINATION: OffersPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: OffersFilters = { isActive: null };

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The backend's automatic class-validator rejection (missing title, malformed imageUrl) collapses
 * to a generic "Bad Request Exception" — confirmed live against the running backend in Sprint
 * 3.3 — so relying on it alone would give restaurant owners no useful feedback. These pre-flight
 * checks catch exactly those cases with a real message *before* the network call; the one
 * genuinely specific backend message ("startsAt must be before endsAt") is still checked here too
 * so the two can never disagree, and any other backend message (e.g. the 403 ownership error) is
 * still surfaced as-is via `extractOfferErrorMessage` on the mutation methods below.
 */
function validateOfferInput(value: OfferFormValue): string[] {
  const errors: string[] = [];
  const title = value.title?.trim();

  if (!title) {
    errors.push('Title is required.');
  }

  if (value.imageUrl && !isValidUrl(value.imageUrl)) {
    errors.push('Image URL must be a valid URL.');
  }

  if (value.startsAt && value.endsAt && new Date(value.startsAt).getTime() >= new Date(value.endsAt).getTime()) {
    errors.push('Start date must be before end date.');
  }

  return errors;
}

function extractOfferErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) {
      return 'You do not have permission to manage offers for this restaurant.';
    }
    if (typeof error.error?.message === 'string' && error.error.message !== 'Bad Request Exception') {
      return error.error.message;
    }
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class RestaurantOffersStore {
  private readonly service = inject(RestaurantOffersService);

  private readonly _offers = signal<OfferResponseDto[]>([]);
  private readonly _pagination = signal<OffersPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<OffersFilters>(DEFAULT_FILTERS);
  private readonly _selectedOffer = signal<OfferResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);
  private readonly _validationErrors = signal<string[]>([]);

  readonly offers = this._offers.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly selectedOffer = this._selectedOffer.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly saving = computed(() => this._processingId() !== null);

  async loadOffers(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const pagination = this._pagination();
      const filters = this._filters();

      const response = await this.service.getOffers({
        page: pagination.page,
        limit: pagination.limit,
        isActive: filters.isActive ?? undefined,
      });

      this._offers.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load offers. Please try again.');
      this._offers.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setActiveFilter(isActive: boolean | null): void {
    this._filters.set({ isActive });
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadOffers();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadOffers();
  }

  selectOffer(offer: OfferResponseDto | null): void {
    this._selectedOffer.set(offer);
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  dismissValidationErrors(): void {
    this._validationErrors.set([]);
  }

  async createOffer(value: OfferFormValue): Promise<boolean> {
    const errors = validateOfferInput(value);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return false;
    }

    this._validationErrors.set([]);
    this._processingId.set('new-offer');
    this._actionError.set(null);

    try {
      await this.service.createOffer(value);
      await this.loadOffers();
      return true;
    } catch (err) {
      this._actionError.set(extractOfferErrorMessage(err, 'Unable to create this offer. Please try again.'));
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  async updateOffer(offerId: string, value: OfferFormValue): Promise<boolean> {
    const errors = validateOfferInput(value);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return false;
    }

    this._validationErrors.set([]);
    this._processingId.set(offerId);
    this._actionError.set(null);

    try {
      const updated = await this.service.updateOffer(offerId, value);
      this._offers.set(this._offers().map((offer) => (offer.id === offerId ? updated : offer)));

      if (this._selectedOffer()?.id === offerId) {
        this._selectedOffer.set(updated);
      }

      return true;
    } catch (err) {
      this._actionError.set(extractOfferErrorMessage(err, 'Unable to update this offer. Please try again.'));
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  async deleteOffer(offerId: string): Promise<boolean> {
    this._processingId.set(offerId);
    this._actionError.set(null);

    try {
      await this.service.deleteOffer(offerId);

      if (this._selectedOffer()?.id === offerId) {
        this._selectedOffer.set(null);
      }

      // Deleting can empty the current page (e.g. the last item on the last page) — reloading
      // rather than filtering client-side keeps pagination.total/totalPages consistent with the
      // server, same as every other mutation here.
      await this.loadOffers();
      return true;
    } catch (err) {
      this._actionError.set(extractOfferErrorMessage(err, 'Unable to delete this offer. Please try again.'));
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  setActive(offerId: string, isActive: boolean): Promise<boolean> {
    return this.transitionOffer(offerId, isActive, (id) =>
      isActive ? this.service.enableOffer(id) : this.service.disableOffer(id),
    );
  }

  /**
   * Optimistically flips `isActive` on the target row, then reconciles with the server response
   * or rolls back on failure — the same pattern restaurant-orders/admin-orders use for status
   * transitions, so Enable/Disable feels identical to accepting or rejecting an order.
   */
  private async transitionOffer(
    offerId: string,
    optimisticIsActive: boolean,
    action: (offerId: string) => Promise<OfferResponseDto>,
  ): Promise<boolean> {
    const original = this._offers().find((offer) => offer.id === offerId);
    if (!original) {
      return false;
    }

    this._processingId.set(offerId);
    this._actionError.set(null);
    this.replaceOffer(offerId, { ...original, isActive: optimisticIsActive });

    try {
      const updated = await action(offerId);
      this.replaceOffer(offerId, updated);

      if (this._selectedOffer()?.id === offerId) {
        this._selectedOffer.set(updated);
      }

      return true;
    } catch (err) {
      this.replaceOffer(offerId, original);
      this._actionError.set(
        extractOfferErrorMessage(err, 'Unable to update this offer. Please try again.'),
      );
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceOffer(offerId: string, replacement: OfferResponseDto): void {
    this._offers.update((offers) => offers.map((offer) => (offer.id === offerId ? replacement : offer)));
  }
}
