import { Injectable, inject } from '@angular/core';
import {
  RestaurantHolidaysService as SdkRestaurantHolidaysService,
  type CreateHolidayDto,
  type HolidayResponseDto,
  type UpdateHolidayDto,
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

/** Stateless backend orchestration for the restaurant-app Holiday Calendar screen. */
@Injectable({ providedIn: 'root' })
export class RestaurantHolidaysFeatureService {
  private readonly holidaysService = inject(SdkRestaurantHolidaysService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getHolidays(): Promise<HolidayResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.holidaysService.holidaysControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async createHoliday(dto: CreateHolidayDto): Promise<HolidayResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.holidaysService.holidaysControllerCreate({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async updateHoliday(holidayId: string, dto: UpdateHolidayDto): Promise<HolidayResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.holidaysService.holidaysControllerUpdate({
      restaurantId,
      holidayId,
      body: dto,
    });
    return unwrap(response);
  }

  async removeHoliday(holidayId: string): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    await this.holidaysService.holidaysControllerRemove({ restaurantId, holidayId });
  }
}
