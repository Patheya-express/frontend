import { Injectable, inject } from '@angular/core';
import {
  OffersService,
  type OfferResponseDto,
  type OffersControllerFindAll$Params,
  type PaginatedOffersResponseDto,
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

export type GetOffersParams = OffersControllerFindAll$Params;

@Injectable({ providedIn: 'root' })
export class CustomerOffersService {
  private readonly offersService = inject(OffersService);

  async getOffers(params: GetOffersParams): Promise<PaginatedOffersResponseDto> {
    const response = await this.offersService.offersControllerFindAll(params);
    return unwrap(response);
  }

  async getOfferById(id: string): Promise<OfferResponseDto> {
    const response = await this.offersService.offersControllerFindById({ id });
    return unwrap(response);
  }

  async getFeatured(limit?: number): Promise<OfferResponseDto[]> {
    const response = await this.offersService.offersControllerFindFeatured({ limit });
    return unwrap(response);
  }

  async getHome(limit?: number): Promise<OfferResponseDto[]> {
    const response = await this.offersService.offersControllerFindHome({ limit });
    return unwrap(response);
  }

  async getByRestaurant(restaurantId: string, params: GetOffersParams): Promise<PaginatedOffersResponseDto> {
    const response = await this.offersService.offersControllerFindByRestaurant({ restaurantId, ...params });
    return unwrap(response);
  }
}
