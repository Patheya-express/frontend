import { Injectable, inject } from '@angular/core';
import {
  RestaurantStaffService as SdkRestaurantStaffService,
  type InviteStaffDto,
  type StaffResponseDto,
  type UpdateStaffDto,
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

/** Stateless backend orchestration for the restaurant-app Staff Management screen. */
@Injectable({ providedIn: 'root' })
export class RestaurantStaffFeatureService {
  private readonly staffService = inject(SdkRestaurantStaffService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getStaff(): Promise<StaffResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.staffService.staffControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async inviteStaff(dto: InviteStaffDto): Promise<StaffResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.staffService.staffControllerInvite({ restaurantId, body: dto });
    return unwrap(response);
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto): Promise<StaffResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.staffService.staffControllerUpdate({
      restaurantId,
      staffId,
      body: dto,
    });
    return unwrap(response);
  }

  async revokeStaff(staffId: string): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    await this.staffService.staffControllerRevoke({ restaurantId, staffId });
  }
}
