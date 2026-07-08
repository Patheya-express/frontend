import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { ConfirmDialogComponent, PaginationComponent, StarRatingComponent } from '@patheya-express-frontend/ui';
import { ReviewsFacade } from '../../facades/reviews.facade';

@Component({
  selector: 'lib-restaurant-reviews-section',
  standalone: true,
  imports: [DatePipe, StarRatingComponent, PaginationComponent, ConfirmDialogComponent],
  templateUrl: './restaurant-reviews-section.component.html',
  styleUrl: './restaurant-reviews-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantReviewsSectionComponent implements OnInit {
  @Input({ required: true }) restaurantId!: string;
  @Input({ required: true }) avgRating!: number;
  @Input({ required: true }) ratingCount!: number;

  private readonly facade = inject(ReviewsFacade);
  private readonly authFacade = inject(AuthFacade);

  protected readonly reviews = this.facade.reviews;
  protected readonly page = this.facade.page;
  protected readonly totalPages = this.facade.totalPages;
  protected readonly total = this.facade.total;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly myReview = this.facade.myReview;
  protected readonly myReviewLoading = this.facade.myReviewLoading;
  protected readonly submitting = this.facade.submitting;
  protected readonly formError = this.facade.formError;
  protected readonly isAuthenticated = this.authFacade.isAuthenticated;

  protected readonly editing = signal(false);
  protected readonly draftRating = signal(0);
  protected readonly draftComment = signal('');
  protected readonly confirmingDelete = signal(false);

  ngOnInit(): void {
    void this.facade.loadReviews(this.restaurantId);

    if (this.isAuthenticated()) {
      void this.facade.loadMyReview(this.restaurantId);
    }
  }

  protected startWriteReview(): void {
    const existing = this.myReview();
    this.draftRating.set(existing?.rating ?? 0);
    this.draftComment.set(existing?.comment ?? '');
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected setDraftRating(rating: number): void {
    this.draftRating.set(rating);
  }

  protected async submit(): Promise<void> {
    if (this.draftRating() < 1) {
      return;
    }

    const success = await this.facade.submitReview(this.draftRating(), this.draftComment().trim() || undefined);

    if (success) {
      this.editing.set(false);
    }
  }

  protected requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected async confirmDelete(): Promise<void> {
    await this.facade.deleteMyReview();
    this.confirmingDelete.set(false);
    this.editing.set(false);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }
}
