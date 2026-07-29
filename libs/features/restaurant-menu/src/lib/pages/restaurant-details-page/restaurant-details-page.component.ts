import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { OperatingHourResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  IconButtonComponent,
  NetworkStatusService,
  SearchInputComponent,
  SkeletonComponent,
  StarRatingComponent,
  ToastService,
} from '@patheya-express-frontend/ui';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { FavoriteButtonComponent, FavoritesFacade } from '@patheya-express-frontend/favorites';
import { OfferCardComponent } from '@patheya-express-frontend/customer-offers';
import { RestaurantMenuFacade } from '../../facades/restaurant-menu.facade';
import { MenuCategoryComponent } from '../../components/menu-category/menu-category.component';
import { MenuCategoryTabsComponent } from '../../components/menu-category-tabs/menu-category-tabs.component';
import { RestaurantReviewsSectionComponent } from '../../components/restaurant-reviews-section/restaurant-reviews-section.component';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Scroll distance (px) past which the sticky restaurant header switches to its compact form. */
const HEADER_COLLAPSE_THRESHOLD = 60;

function toMinutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

@Component({
  selector: 'lib-restaurant-details-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SearchInputComponent,
    StarRatingComponent,
    IconButtonComponent,
    MenuCategoryComponent,
    MenuCategoryTabsComponent,
    RestaurantReviewsSectionComponent,
    FavoriteButtonComponent,
    OfferCardComponent,
  ],
  templateUrl: './restaurant-details-page.component.html',
  styleUrl: './restaurant-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantDetailsPageComponent implements OnInit {
  private readonly facade = inject(RestaurantMenuFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaUrlService = inject(MediaUrlService);
  private readonly authFacade = inject(AuthFacade);
  private readonly favoritesFacade = inject(FavoritesFacade);
  private readonly networkStatus = inject(NetworkStatusService);
  private readonly toastService = inject(ToastService);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly restaurant = this.facade.restaurant;
  protected readonly menu = this.facade.menu;
  protected readonly loading = this.facade.loading;
  protected readonly menuLoading = this.facade.menuLoading;
  protected readonly error = this.facade.error;
  protected readonly isEmpty = this.facade.isEmpty;
  protected readonly search = this.facade.search;

  protected readonly headerCollapsed = signal(false);

  protected readonly errorTitle = computed(() =>
    this.networkStatus.isOffline() ? "You're offline" : 'Something went wrong',
  );

  protected readonly emptyStateTitle = computed(() => (this.search() ? 'No dishes found' : 'No menu items yet'));
  protected readonly emptyStateMessage = computed(() =>
    this.search()
      ? `Nothing matches "${this.search()}". Try a different search.`
      : "This restaurant hasn't added their menu yet. Check back later.",
  );

  /** `undefined` when no operating-hours data exists at all — never guess open/closed without it. */
  protected readonly isOpenNow = computed<boolean | undefined>(() => {
    const hours = this.restaurant()?.branches?.[0]?.operatingHours;
    if (!hours || hours.length === 0) {
      return undefined;
    }

    const now = new Date();
    const today = hours.find((hour) => hour.dayOfWeek === now.getDay());
    if (!today || today.isClosed) {
      return false;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= toMinutesSinceMidnight(today.opensAt) && nowMinutes < toMinutesSinceMidnight(today.closesAt);
  });

  private restaurantId = '';

  constructor() {
    // One bulk favorite-status request for the restaurant and one for every dish on the page —
    // never one request per card.
    effect(() => {
      const restaurant = this.restaurant();
      if (this.authFacade.isAuthenticated() && restaurant) {
        void this.favoritesFacade.checkRestaurantFavorites([restaurant.id]);
      }
    });

    effect(() => {
      const categories = this.menu();
      if (!this.authFacade.isAuthenticated() || categories.length === 0) {
        return;
      }
      const itemIds = categories.flatMap((category) => category.menuItems.map((item) => item.id));
      void this.favoritesFacade.checkMenuItemFavorites(itemIds);
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('restaurantId');
      if (id) {
        this.restaurantId = id;
        void this.facade.loadRestaurantMenu(id);
      }
    });
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    this.headerCollapsed.set(window.scrollY > HEADER_COLLAPSE_THRESHOLD);
  }

  protected retry(): void {
    if (this.restaurantId) {
      void this.facade.loadRestaurantMenu(this.restaurantId);
    }
  }

  protected onSearch(query: string): void {
    void this.facade.searchMenu(query);
  }

  protected coverImageUrl(bannerUrl?: string, logoUrl?: string): string | undefined {
    return this.mediaUrlService.resolve(bannerUrl ?? logoUrl);
  }

  protected formatOperatingHours(hour: OperatingHourResponseDto): string {
    const day = DAY_NAMES[hour.dayOfWeek] ?? '';
    return hour.isClosed ? `${day}: Closed` : `${day}: ${hour.opensAt} - ${hour.closesAt}`;
  }

  protected formatAddress(branch: { addressLine1?: string; addressLine2?: string; city: string; state?: string; postalCode?: string }): string {
    return [branch.addressLine1, branch.addressLine2, branch.city, branch.state, branch.postalCode]
      .filter((part) => !!part)
      .join(', ');
  }

  /** Extension point: no native Share Sheet integration yet (needs a Capacitor `@capacitor/share`
   *  plugin wired per-app) — this is honest about that instead of silently doing nothing. */
  protected onShareTapped(): void {
    this.toastService.showToast({ message: 'Sharing is coming soon.', tone: 'neutral' });
  }
}
