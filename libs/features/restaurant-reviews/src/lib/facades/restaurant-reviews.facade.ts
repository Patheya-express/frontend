import { Injectable, inject } from '@angular/core';
import type { ReviewResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantReviewsStore, type ReviewsFilters } from '../store/restaurant-reviews.store';

@Injectable({ providedIn: 'root' })
export class RestaurantReviewsFacade {
  private readonly store = inject(RestaurantReviewsStore);

  readonly reviews = this.store.reviews;
  readonly ratingSummary = this.store.ratingSummary;
  readonly pagination = this.store.pagination;
  readonly filters = this.store.filters;
  readonly selectedReview = this.store.selectedReview;
  readonly loading = this.store.loading;
  readonly saving = this.store.saving;
  readonly processingId = this.store.processingId;
  readonly error = this.store.error;
  readonly actionError = this.store.actionError;
  readonly validationErrors = this.store.validationErrors;

  async initialize(): Promise<void> {
    await Promise.all([this.store.loadReviews(), this.store.loadRatingSummary()]);
  }

  refresh(): Promise<void> {
    return this.store.loadReviews();
  }

  setFilters(filters: Partial<ReviewsFilters>): void {
    this.store.setFilters(filters);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectReview(review: ReviewResponseDto | null): void {
    this.store.selectReview(review);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }

  dismissValidationErrors(): void {
    this.store.dismissValidationErrors();
  }

  createReply(reviewId: string, replyText: string): Promise<boolean> {
    return this.store.createReply(reviewId, replyText);
  }

  updateReply(reviewId: string, replyText: string): Promise<boolean> {
    return this.store.updateReply(reviewId, replyText);
  }

  deleteReply(reviewId: string): Promise<boolean> {
    return this.store.deleteReply(reviewId);
  }
}
