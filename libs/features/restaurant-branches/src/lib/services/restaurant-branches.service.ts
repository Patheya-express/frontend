import { Injectable, inject } from '@angular/core';
import {
  RestaurantBranchesService as SdkRestaurantBranchesService,
  BranchOperatingHoursService,
  type BranchResponseDto,
  type CreateBranchDto,
  type UpdateBranchDto,
  type OperatingHourResponseDto,
  type UpsertOperatingHourDto,
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

/** Stateless backend orchestration for the restaurant-app Branch Management + Operating Hours screens. */
@Injectable({ providedIn: 'root' })
export class RestaurantBranchesFeatureService {
  private readonly branchesService = inject(SdkRestaurantBranchesService);
  private readonly operatingHoursService = inject(BranchOperatingHoursService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getBranches(): Promise<BranchResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.branchesService.branchesControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async createBranch(dto: CreateBranchDto): Promise<BranchResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.branchesService.branchesControllerCreate({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async updateBranch(branchId: string, dto: UpdateBranchDto): Promise<BranchResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.branchesService.branchesControllerUpdate({
      restaurantId,
      branchId,
      body: dto,
    });
    return unwrap(response);
  }

  async removeBranch(branchId: string): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    await this.branchesService.branchesControllerRemove({ restaurantId, branchId });
  }

  async getOperatingHours(branchId: string): Promise<OperatingHourResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.operatingHoursService.operatingHoursControllerFindAll({
      restaurantId,
      branchId,
    });
    return unwrap(response);
  }

  async replaceOperatingHours(
    branchId: string,
    hours: UpsertOperatingHourDto[],
  ): Promise<OperatingHourResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.operatingHoursService.operatingHoursControllerReplaceAll({
      restaurantId,
      branchId,
      body: { hours },
    });
    return unwrap(response);
  }
}
