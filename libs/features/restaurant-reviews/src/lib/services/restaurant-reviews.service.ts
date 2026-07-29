import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService as SdkRestaurantsService,
  type PaginatedReviewsResponseDto,
  type RatingSummaryResponseDto,
  type ReviewResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';

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

export interface GetRestaurantReviewsQuery {
  page: number;
  limit: number;
  rating?: number;
  dateFrom?: string;
  dateTo?: string;
  hasReply?: boolean;
}

/** Stateless backend orchestration for the restaurant-app Reviews management screen. */
@Injectable({ providedIn: 'root' })
export class RestaurantReviewsService {
  private readonly restaurantsService = inject(SdkRestaurantsService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getReviews(query: GetRestaurantReviewsQuery): Promise<PaginatedReviewsResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.reviewsControllerGetReviewsForManage({
      id: restaurantId,
      page: query.page,
      limit: query.limit,
      rating: query.rating,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      hasReply: query.hasReply,
    });
    return unwrap(response);
  }

  async getRatingSummary(): Promise<RatingSummaryResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.reviewsControllerGetRatingSummary({ id: restaurantId });
    return unwrap(response);
  }

  async createReply(reviewId: string, replyText: string): Promise<ReviewResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.reviewsControllerCreateReply({
      id: restaurantId,
      reviewId,
      body: { replyText },
    });
    return unwrap(response);
  }

  async updateReply(reviewId: string, replyText: string): Promise<ReviewResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.reviewsControllerUpdateReply({
      id: restaurantId,
      reviewId,
      body: { replyText },
    });
    return unwrap(response);
  }

  async deleteReply(reviewId: string): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    await this.restaurantsService.reviewsControllerDeleteReply({ id: restaurantId, reviewId });
  }
}
