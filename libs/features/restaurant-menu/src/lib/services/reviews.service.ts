import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService,
  type CreateReviewDto,
  type PaginatedReviewsResponseDto,
  type ReviewResponseDto,
} from '@patheya-express-frontend/api-sdk';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly restaurantsService = inject(RestaurantsService);

  async getReviews(restaurantId: string, page: number, limit: number): Promise<PaginatedReviewsResponseDto> {
    const response = await this.restaurantsService.reviewsControllerGetReviews({ id: restaurantId, page, limit });
    return unwrap(response);
  }

  /** Returns null if the current customer hasn't reviewed this restaurant yet. */
  async getMyReview(restaurantId: string): Promise<ReviewResponseDto | null> {
    const response = await this.restaurantsService.reviewsControllerGetMyReview({ id: restaurantId });
    return unwrap(response) as ReviewResponseDto | null;
  }

  async submitReview(restaurantId: string, dto: CreateReviewDto): Promise<ReviewResponseDto> {
    const response = await this.restaurantsService.reviewsControllerCreateReview({ id: restaurantId, body: dto });
    return unwrap(response);
  }

  async deleteReview(restaurantId: string): Promise<void> {
    await this.restaurantsService.reviewsControllerDeleteReview({ id: restaurantId });
  }
}
