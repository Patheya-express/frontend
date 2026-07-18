import { Injectable, inject } from '@angular/core';
import {
  RestaurantMediaService,
  RestaurantsService,
  type MediaResponseDto,
  type RestaurantResponseDto,
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

export type GalleryMediaType = Exclude<MediaResponseDto['type'], 'LOGO' | 'BANNER'>;

/** Stateless backend orchestration for the restaurant-app Gallery + Logo/Banner screen. */
@Injectable({ providedIn: 'root' })
export class RestaurantGalleryFeatureService {
  private readonly mediaService = inject(RestaurantMediaService);
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getMedia(): Promise<MediaResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.mediaService.mediaControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async uploadMedia(type: GalleryMediaType, file: File): Promise<MediaResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.mediaService.mediaControllerUpload({
      restaurantId,
      body: { file, type },
    });
    return unwrap(response);
  }

  async reorderMedia(mediaIds: string[]): Promise<MediaResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.mediaService.mediaControllerReorder({
      restaurantId,
      body: { mediaIds },
    });
    return unwrap(response);
  }

  async removeMedia(mediaId: string): Promise<void> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    await this.mediaService.mediaControllerRemove({ restaurantId, mediaId });
  }

  async uploadLogo(file: File): Promise<RestaurantResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.restaurantsControllerUploadLogo({
      id: restaurantId,
      body: { file },
    });
    return unwrap(response);
  }

  async uploadBanner(file: File): Promise<RestaurantResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.restaurantsControllerUploadBanner({
      id: restaurantId,
      body: { file },
    });
    return unwrap(response);
  }
}
