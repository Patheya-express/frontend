import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import type { ReviewResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SkeletonComponent,
  StarRatingComponent,
  StatusChipComponent,
} from '@patheya-express-frontend/ui';
import { RestaurantReviewsFacade } from '../../facades/restaurant-reviews.facade';
import { ReplyFormComponent } from '../../components/reply-form/reply-form.component';

type ReplyFilter = 'ALL' | 'REPLIED' | 'UNREPLIED';

const REPLY_FILTERS: { value: ReplyFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'REPLIED', label: 'Replied' },
  { value: 'UNREPLIED', label: 'Awaiting Reply' },
];

const RATING_OPTIONS = [5, 4, 3, 2, 1];

interface ReplyFormTarget {
  reviewId: string;
  /** undefined = creating a new reply; a string (possibly empty) = editing the existing one. */
  existingReplyText?: string;
}

@Component({
  selector: 'lib-review-list-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    StarRatingComponent,
    StatusChipComponent,
    PaginationComponent,
    ConfirmDialogComponent,
    ReplyFormComponent,
  ],
  templateUrl: './review-list-page.component.html',
  styleUrl: './review-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewListPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantReviewsFacade);
  protected readonly replyFilters = REPLY_FILTERS;
  protected readonly ratingOptions = RATING_OPTIONS;

  protected replyFilter: ReplyFilter = 'ALL';
  /** Only one review's reply form is ever open at a time — same convention as every other list-with-inline-form page in this codebase (menu-management, restaurant-offers). */
  protected replyFormTarget: ReplyFormTarget | null = null;
  protected confirmDeleteId: string | null = null;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onRatingFilterChange(value: string): void {
    this.facade.setFilters({ rating: value ? Number(value) : null });
  }

  protected onReplyFilterChange(filter: ReplyFilter): void {
    this.replyFilter = filter;
    this.facade.setFilters({ hasReply: filter === 'ALL' ? null : filter === 'REPLIED' });
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected isReplyFormOpenFor(reviewId: string): boolean {
    return this.replyFormTarget?.reviewId === reviewId;
  }

  protected openCreateReply(review: ReviewResponseDto): void {
    this.replyFormTarget = { reviewId: review.id };
  }

  protected openEditReply(review: ReviewResponseDto): void {
    this.replyFormTarget = { reviewId: review.id, existingReplyText: review.replyText ?? '' };
  }

  protected closeReplyForm(): void {
    this.replyFormTarget = null;
  }

  protected isProcessing(reviewId: string): boolean {
    return this.facade.processingId() === reviewId;
  }

  protected requestDeleteReply(reviewId: string): void {
    this.confirmDeleteId = reviewId;
  }

  protected cancelDeleteReply(): void {
    this.confirmDeleteId = null;
  }

  protected async confirmDeleteReply(): Promise<void> {
    const reviewId = this.confirmDeleteId;
    if (!reviewId) {
      return;
    }
    this.confirmDeleteId = null;
    await this.facade.deleteReply(reviewId);
  }

  protected dismissActionError(): void {
    this.facade.dismissActionError();
  }
}
