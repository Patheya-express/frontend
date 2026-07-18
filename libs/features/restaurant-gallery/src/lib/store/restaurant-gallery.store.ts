import { Injectable, computed, inject, signal } from '@angular/core';
import type { MediaResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';
import { RestaurantGalleryFeatureService, type GalleryMediaType } from '../services/restaurant-gallery.service';

@Injectable({ providedIn: 'root' })
export class RestaurantGalleryStore {
  private readonly service = inject(RestaurantGalleryFeatureService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  private readonly _media = signal<MediaResponseDto[]>([]);
  private readonly _logoUrl = signal<string | undefined>(undefined);
  private readonly _bannerUrl = signal<string | undefined>(undefined);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _uploadingLogo = signal(false);
  private readonly _uploadingBanner = signal(false);
  private readonly _uploadingMedia = signal(false);
  private readonly _actionError = signal<string | null>(null);

  readonly media = this._media.asReadonly();
  readonly logoUrl = this._logoUrl.asReadonly();
  readonly bannerUrl = this._bannerUrl.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly uploadingLogo = this._uploadingLogo.asReadonly();
  readonly uploadingBanner = this._uploadingBanner.asReadonly();
  readonly uploadingMedia = this._uploadingMedia.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly galleryItems = computed(() => [...this._media()].sort((a, b) => a.sortOrder - b.sortOrder));

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [media] = await Promise.all([this.service.getMedia()]);
      this._media.set(media);

      const restaurant = this.currentRestaurant.currentRestaurant();
      this._logoUrl.set(restaurant?.logoUrl);
      this._bannerUrl.set(restaurant?.bannerUrl);
    } catch {
      this._error.set('Unable to load restaurant media. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async uploadLogo(file: File): Promise<boolean> {
    this._uploadingLogo.set(true);
    this._actionError.set(null);

    try {
      const restaurant = await this.service.uploadLogo(file);
      this._logoUrl.set(restaurant.logoUrl);
      return true;
    } catch {
      this._actionError.set('Unable to upload the logo. Please try again.');
      return false;
    } finally {
      this._uploadingLogo.set(false);
    }
  }

  async uploadBanner(file: File): Promise<boolean> {
    this._uploadingBanner.set(true);
    this._actionError.set(null);

    try {
      const restaurant = await this.service.uploadBanner(file);
      this._bannerUrl.set(restaurant.bannerUrl);
      return true;
    } catch {
      this._actionError.set('Unable to upload the banner. Please try again.');
      return false;
    } finally {
      this._uploadingBanner.set(false);
    }
  }

  async uploadMedia(type: GalleryMediaType, file: File): Promise<boolean> {
    this._uploadingMedia.set(true);
    this._actionError.set(null);

    try {
      const item = await this.service.uploadMedia(type, file);
      this._media.set([...this._media(), item]);
      return true;
    } catch {
      this._actionError.set('Unable to upload this image. Please try again.');
      return false;
    } finally {
      this._uploadingMedia.set(false);
    }
  }

  async reorder(mediaIds: string[]): Promise<boolean> {
    this._actionError.set(null);

    try {
      const reordered = await this.service.reorderMedia(mediaIds);
      this._media.set(reordered);
      return true;
    } catch {
      this._actionError.set('Unable to reorder the gallery. Please try again.');
      return false;
    }
  }

  async removeMedia(mediaId: string): Promise<boolean> {
    this._actionError.set(null);

    try {
      await this.service.removeMedia(mediaId);
      this._media.set(this._media().filter((item) => item.id !== mediaId));
      return true;
    } catch {
      this._actionError.set('Unable to remove this image. Please try again.');
      return false;
    }
  }
}
