import { Injectable, inject } from '@angular/core';
import { APP_ENVIRONMENT } from '../environment/app-environment';

/**
 * The backend returns uploaded media (restaurant logos/banners, offer images, etc.) as paths
 * relative to the API origin (e.g. `/uploads/restaurants/logos/x.png`), not the frontend's own
 * origin. Used directly as an `<img src>`, a relative path resolves against the page's own
 * origin and 404s. This resolves it against the configured media origin (production points this
 * at a CDN/S3 origin; development/staging point it at the API origin, same as local storage).
 */
@Injectable({ providedIn: 'root' })
export class MediaUrlService {
  private readonly environment = inject(APP_ENVIRONMENT);

  resolve(path: string | undefined | null): string | undefined {
    if (!path) {
      return undefined;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.environment.mediaBaseUrl}${path}`;
  }
}
