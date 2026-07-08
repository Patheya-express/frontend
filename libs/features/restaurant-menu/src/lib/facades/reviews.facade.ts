import { Injectable, inject } from '@angular/core';
import { ReviewsStore } from '../store/reviews.store';

@Injectable({ providedIn: 'root' })
export class ReviewsFacade {
  private readonly store = inject(ReviewsStore);

  readonly reviews = this.store.reviews;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly total = this.store.total;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly myReview = this.store.myReview;
  readonly myReviewLoading = this.store.myReviewLoading;
  readonly submitting = this.store.submitting;
  readonly formError = this.store.formError;

  loadReviews(restaurantId: string): Promise<void> {
    return this.store.loadReviews(restaurantId);
  }

  loadMyReview(restaurantId: string): Promise<void> {
    return this.store.loadMyReview(restaurantId);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  submitReview(rating: number, comment: string | undefined): Promise<boolean> {
    return this.store.submitReview(rating, comment);
  }

  deleteMyReview(): Promise<void> {
    return this.store.deleteMyReview();
  }
}
