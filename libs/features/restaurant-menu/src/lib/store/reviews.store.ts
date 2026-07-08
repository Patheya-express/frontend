import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { ReviewResponseDto } from '@patheya-express-frontend/api-sdk';
import { ReviewsService } from '../services/reviews.service';

const PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class ReviewsStore {
  private readonly reviewsService = inject(ReviewsService);

  private readonly _reviews = signal<ReviewResponseDto[]>([]);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _myReview = signal<ReviewResponseDto | null>(null);
  private readonly _myReviewLoading = signal(false);
  private readonly _submitting = signal(false);
  private readonly _formError = signal<string | null>(null);

  private restaurantId = '';

  readonly reviews = this._reviews.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly myReview = this._myReview.asReadonly();
  readonly myReviewLoading = this._myReviewLoading.asReadonly();
  readonly submitting = this._submitting.asReadonly();
  readonly formError = this._formError.asReadonly();

  async loadReviews(restaurantId: string, page = 1): Promise<void> {
    this.restaurantId = restaurantId;
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await this.reviewsService.getReviews(restaurantId, page, PAGE_SIZE);
      this._reviews.set(result.items);
      this._page.set(result.page);
      this._totalPages.set(Math.max(1, result.totalPages));
      this._total.set(result.total);
    } catch {
      this._error.set('Unable to load reviews.');
    } finally {
      this._loading.set(false);
    }
  }

  setPage(page: number): void {
    void this.loadReviews(this.restaurantId, page);
  }

  async loadMyReview(restaurantId: string): Promise<void> {
    this.restaurantId = restaurantId;
    this._myReviewLoading.set(true);

    try {
      const review = await this.reviewsService.getMyReview(restaurantId);
      this._myReview.set(review);
    } catch {
      this._myReview.set(null);
    } finally {
      this._myReviewLoading.set(false);
    }
  }

  async submitReview(rating: number, comment: string | undefined): Promise<boolean> {
    this._submitting.set(true);
    this._formError.set(null);

    try {
      const review = await this.reviewsService.submitReview(this.restaurantId, { rating, comment });
      this._myReview.set(review);
      await this.loadReviews(this.restaurantId, 1);
      return true;
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 403) {
        this._formError.set("You can only review a restaurant after a delivered order from it.");
      } else {
        this._formError.set('Unable to submit your review. Please try again.');
      }
      return false;
    } finally {
      this._submitting.set(false);
    }
  }

  async deleteMyReview(): Promise<void> {
    this._formError.set(null);

    try {
      await this.reviewsService.deleteReview(this.restaurantId);
      this._myReview.set(null);
      await this.loadReviews(this.restaurantId, 1);
    } catch {
      this._formError.set('Unable to delete your review.');
    }
  }
}
