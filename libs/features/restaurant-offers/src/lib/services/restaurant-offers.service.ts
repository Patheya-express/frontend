import { Injectable, inject } from '@angular/core';
import {
  OffersService as SdkOffersService,
  type CreateOfferDto,
  type OfferResponseDto,
  type PaginatedOffersResponseDto,
  type UpdateOfferDto,
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

export interface GetRestaurantOffersQuery {
  page: number;
  limit: number;
  isActive?: boolean;
}

/** Everything CreateOfferDto needs except `restaurantId`, which this service resolves itself via
 *  RestaurantContextService — the same convention menu-management/restaurant-gallery use so
 *  components/stores never have to know or pass the current restaurant id explicitly. */
export type OfferFormValue = Omit<CreateOfferDto, 'restaurantId'>;

/** Stateless backend orchestration for the restaurant-app Offers management screen. */
@Injectable({ providedIn: 'root' })
export class RestaurantOffersService {
  private readonly offersService = inject(SdkOffersService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getOffers(query: GetRestaurantOffersQuery): Promise<PaginatedOffersResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.offersService.offersControllerFindAllForRestaurant({
      restaurantId,
      page: query.page,
      limit: query.limit,
      isActive: query.isActive,
    });
    return unwrap(response);
  }

  async createOffer(value: OfferFormValue): Promise<OfferResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const body: CreateOfferDto = { ...value, restaurantId };
    const response = await this.offersService.offersControllerCreate({ body });
    return unwrap(response);
  }

  async updateOffer(offerId: string, value: OfferFormValue): Promise<OfferResponseDto> {
    const body: UpdateOfferDto = value;
    const response = await this.offersService.offersControllerUpdate({ id: offerId, body });
    return unwrap(response);
  }

  async deleteOffer(offerId: string): Promise<void> {
    await this.offersService.offersControllerRemove({ id: offerId });
  }

  async enableOffer(offerId: string): Promise<OfferResponseDto> {
    const response = await this.offersService.offersControllerEnable({ id: offerId });
    return unwrap(response);
  }

  async disableOffer(offerId: string): Promise<OfferResponseDto> {
    const response = await this.offersService.offersControllerDisable({ id: offerId });
    return unwrap(response);
  }
}
