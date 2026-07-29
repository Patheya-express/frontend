import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { RatingSummaryResponseDto, ReviewResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantReviewsService } from '../services/restaurant-reviews.service';

export interface ReviewsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReviewsFilters {
  rating: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  /** null = both replied and unreplied reviews. */
  hasReply: boolean | null;
}

const DEFAULT_PAGINATION: ReviewsPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: ReviewsFilters = { rating: null, dateFrom: null, dateTo: null, hasReply: null };
const MAX_REPLY_LENGTH = 1000;

function validateReplyInput(replyText: string): string[] {
  const errors: string[] = [];
  const trimmed = replyText.trim();

  if (!trimmed) {
    errors.push('Reply is required.');
  }

  if (trimmed.length > MAX_REPLY_LENGTH) {
    errors.push(`Reply cannot exceed ${MAX_REPLY_LENGTH} characters.`);
  }

  return errors;
}

/** Mirrors extractOfferErrorMessage (restaurant-offers) — the backend's automatic class-validator
 *  rejection collapses to a generic "Bad Request Exception" with no field detail, so this only
 *  surfaces backend messages that are actually specific (403 ownership, the duplicate-reply 400). */
function extractReviewErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) {
      return 'You do not have permission to manage reviews for this restaurant.';
    }
    if (typeof error.error?.message === 'string' && error.error.message !== 'Bad Request Exception') {
      return error.error.message;
    }
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class RestaurantReviewsStore {
  private readonly service = inject(RestaurantReviewsService);

  private readonly _reviews = signal<ReviewResponseDto[]>([]);
  private readonly _ratingSummary = signal<RatingSummaryResponseDto | null>(null);
  private readonly _pagination = signal<ReviewsPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<ReviewsFilters>(DEFAULT_FILTERS);
  private readonly _selectedReview = signal<ReviewResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);
  private readonly _validationErrors = signal<string[]>([]);

  readonly reviews = this._reviews.asReadonly();
  readonly ratingSummary = this._ratingSummary.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly selectedReview = this._selectedReview.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly saving = computed(() => this._processingId() !== null);

  async loadReviews(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const pagination = this._pagination();
      const filters = this._filters();

      const response = await this.service.getReviews({
        page: pagination.page,
        limit: pagination.limit,
        rating: filters.rating ?? undefined,
        dateFrom: filters.dateFrom ?? undefined,
        dateTo: filters.dateTo ?? undefined,
        hasReply: filters.hasReply ?? undefined,
      });

      this._reviews.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load reviews. Please try again.');
      this._reviews.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  async loadRatingSummary(): Promise<void> {
    try {
      this._ratingSummary.set(await this.service.getRatingSummary());
    } catch {
      // The rating summary is a supplementary display element — a failure here shouldn't block
      // the review list itself, which already has its own loading/error state.
      this._ratingSummary.set(null);
    }
  }

  setFilters(filters: Partial<ReviewsFilters>): void {
    this._filters.update((current) => ({ ...current, ...filters }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadReviews();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadReviews();
  }

  selectReview(review: ReviewResponseDto | null): void {
    this._selectedReview.set(review);
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  dismissValidationErrors(): void {
    this._validationErrors.set([]);
  }

  async createReply(reviewId: string, replyText: string): Promise<boolean> {
    const errors = validateReplyInput(replyText);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return false;
    }

    this._validationErrors.set([]);
    this._processingId.set(reviewId);
    this._actionError.set(null);

    try {
      const updated = await this.service.createReply(reviewId, replyText.trim());
      this.replaceReview(reviewId, updated);
      return true;
    } catch (err) {
      this._actionError.set(extractReviewErrorMessage(err, 'Unable to post this reply. Please try again.'));
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  async updateReply(reviewId: string, replyText: string): Promise<boolean> {
    const errors = validateReplyInput(replyText);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return false;
    }

    this._validationErrors.set([]);
    this._processingId.set(reviewId);
    this._actionError.set(null);

    try {
      const updated = await this.service.updateReply(reviewId, replyText.trim());
      this.replaceReview(reviewId, updated);
      return true;
    } catch (err) {
      this._actionError.set(extractReviewErrorMessage(err, 'Unable to update this reply. Please try again.'));
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  async deleteReply(reviewId: string): Promise<boolean> {
    this._processingId.set(reviewId);
    this._actionError.set(null);

    try {
      await this.service.deleteReply(reviewId);

      // The delete endpoint returns no body — clear the reply fields locally rather than
      // re-fetching the whole page, matching the confirmed-successful server state.
      const current = this._reviews().find((review) => review.id === reviewId);
      if (current) {
        this.replaceReview(reviewId, {
          ...current,
          replyText: undefined,
          replyCreatedAt: undefined,
          replyUpdatedAt: undefined,
        });
      }

      return true;
    } catch (err) {
      this._actionError.set(extractReviewErrorMessage(err, 'Unable to delete this reply. Please try again.'));
      return false;
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceReview(reviewId: string, replacement: ReviewResponseDto): void {
    this._reviews.update((reviews) => reviews.map((review) => (review.id === reviewId ? replacement : review)));

    if (this._selectedReview()?.id === reviewId) {
      this._selectedReview.set(replacement);
    }
  }
}
