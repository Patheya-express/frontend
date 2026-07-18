import { Injectable, inject } from '@angular/core';
import {
  RestaurantSettingsService as SdkRestaurantSettingsService,
  type RestaurantSettingsResponseDto,
  type UpsertRestaurantSettingsDto,
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

/** Stateless backend orchestration for the restaurant-app Business/Operational Settings pages. */
@Injectable({ providedIn: 'root' })
export class RestaurantSettingsFeatureService {
  private readonly settingsService = inject(SdkRestaurantSettingsService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getSettings(): Promise<RestaurantSettingsResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.settingsService.settingsControllerFind({ restaurantId });
    return unwrap(response);
  }

  async upsertSettings(dto: UpsertRestaurantSettingsDto): Promise<RestaurantSettingsResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.settingsService.settingsControllerUpsert({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }
}
