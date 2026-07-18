import { Injectable, inject } from '@angular/core';
import { RestaurantGalleryStore } from '../store/restaurant-gallery.store';
import type { GalleryMediaType } from '../services/restaurant-gallery.service';

@Injectable({ providedIn: 'root' })
export class RestaurantGalleryFacade {
  private readonly store = inject(RestaurantGalleryStore);

  readonly media = this.store.galleryItems;
  readonly logoUrl = this.store.logoUrl;
  readonly bannerUrl = this.store.bannerUrl;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly uploadingLogo = this.store.uploadingLogo;
  readonly uploadingBanner = this.store.uploadingBanner;
  readonly uploadingMedia = this.store.uploadingMedia;
  readonly actionError = this.store.actionError;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.load();
  }

  uploadLogo(file: File): Promise<boolean> {
    return this.store.uploadLogo(file);
  }

  uploadBanner(file: File): Promise<boolean> {
    return this.store.uploadBanner(file);
  }

  uploadMedia(type: GalleryMediaType, file: File): Promise<boolean> {
    return this.store.uploadMedia(type, file);
  }

  reorder(mediaIds: string[]): Promise<boolean> {
    return this.store.reorder(mediaIds);
  }

  removeMedia(mediaId: string): Promise<boolean> {
    return this.store.removeMedia(mediaId);
  }
}
