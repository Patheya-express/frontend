import { Injectable, computed, signal } from '@angular/core';

export type MobileBreakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';

/**
 * Reactive viewport breakpoint — the "use responsive techniques instead of duplicate components"
 * primitive called for by the shared-ui/mobile-ui unification: a component branches its
 * template/host classes/variant on `breakpoint()` rather than a separate implementation existing
 * per platform. Three tiers (mobile/tablet/desktop) match `@patheya-express-frontend/ui`'s
 * `layouts/mobile|tablet|desktop` folders. Complements `MobilePlatformService` (native shell
 * detection) — this is about viewport size, not runtime (a desktop browser resized narrow is
 * `isMobile()`, same as a phone; the Capacitor app on a tablet is `isTablet()` and `isNative()`).
 */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly breakpointSignal = signal<MobileBreakpoint>(this.readCurrentBreakpoint());

  readonly breakpoint = this.breakpointSignal.asReadonly();
  readonly isMobile = computed(() => this.breakpointSignal() === 'mobile');
  readonly isTablet = computed(() => this.breakpointSignal() === 'tablet');
  readonly isDesktop = computed(() => this.breakpointSignal() === 'desktop');

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const update = (): void => this.breakpointSignal.set(this.readCurrentBreakpoint());
    window.matchMedia(MOBILE_QUERY).addEventListener('change', update);
    window.matchMedia(TABLET_QUERY).addEventListener('change', update);
  }

  private readCurrentBreakpoint(): MobileBreakpoint {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return 'desktop';
    }

    if (window.matchMedia(MOBILE_QUERY).matches) {
      return 'mobile';
    }

    if (window.matchMedia(TABLET_QUERY).matches) {
      return 'tablet';
    }

    return 'desktop';
  }
}
