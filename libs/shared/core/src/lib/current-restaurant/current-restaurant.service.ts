import { Injectable, inject } from '@angular/core';
import { RestaurantsService } from '@patheya-express-frontend/api-sdk';

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

/**
 * Resolves the current restaurant owner's restaurant id.
 *
 * There is no `/orders/restaurant/me`-style endpoint yet, so this is resolved via
 * `/restaurants/me` (the first restaurant returned) and cached for the app's lifetime.
 * Shared across all restaurant-facing features so the lookup is never duplicated; if a
 * dedicated endpoint appears, or multi-restaurant owners need to be supported, only this
 * service needs to change.
 */
@Injectable({ providedIn: 'root' })
export class CurrentRestaurantService {
  private readonly restaurantsService = inject(RestaurantsService);

  private restaurantIdPromise: Promise<string> | null = null;

  getRestaurantId(): Promise<string> {
    if (!this.restaurantIdPromise) {
      this.restaurantIdPromise = this.fetchRestaurantId().catch((error) => {
        this.restaurantIdPromise = null;
        throw error;
      });
    }
    return this.restaurantIdPromise;
  }

  private async fetchRestaurantId(): Promise<string> {
    const response = await this.restaurantsService.restaurantsControllerGetMyRestaurants();
    const restaurants = unwrap(response);
    const restaurant = restaurants[0];

    if (!restaurant) {
      throw new Error('No restaurant found for the current owner.');
    }

    return restaurant.id;
  }
}
