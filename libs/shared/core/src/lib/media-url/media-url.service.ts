import { Injectable, inject } from '@angular/core';
import { ApiConfiguration } from '@patheya-express-frontend/api-sdk';

/**
 * The backend returns uploaded media (restaurant logos/banners, offer images, etc.) as paths
 * relative to the API origin (e.g. `/uploads/restaurants/logos/x.png`), not the frontend's own
 * origin. Used directly as an `<img src>`, a relative path resolves against the page's own
 * origin and 404s. This resolves it against the same `ApiConfiguration.rootUrl` the generated
 * SDK already uses for API calls.
 */
@Injectable({ providedIn: 'root' })
export class MediaUrlService {
  private readonly apiConfiguration = inject(ApiConfiguration);

  resolve(path: string | undefined | null): string | undefined {
    if (!path) {
      return undefined;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.apiConfiguration.rootUrl}${path}`;
  }
}
