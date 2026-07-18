import { Injectable, computed, inject, signal } from '@angular/core';
import {
  RestaurantsService,
  RestaurantBranchesService,
  RestaurantStaffService,
} from '@patheya-express-frontend/api-sdk';
import type {
  RestaurantResponseDto,
  BranchResponseDto,
  StaffResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';

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

export type RestaurantRole = StaffResponseDto['role'] | 'OWNER';

/**
 * Resolves the restaurant/branch/role the current user is operating as. Replaces the previous
 * CurrentRestaurantService, whose sole method took `restaurants[0]` from `/restaurants/me` and
 * offered no branch or role concept — the exact assumption ERPH-1 removes. `getRestaurantId()`
 * is kept as a compatibility method so existing consumers (menu-management, restaurant-
 * dashboard, restaurant-orders) only need an import swap.
 *
 * Even where a user has exactly one restaurant and one branch today, this always resolves
 * "current" explicitly (via `restaurants[0]`/primary branch as an initial default) rather than
 * assuming it structurally — `setCurrentRestaurant`/`setCurrentBranch` let a future multi-
 * restaurant/multi-branch switcher UI change it without touching this service again.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantContextService {
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly branchesService = inject(RestaurantBranchesService);
  private readonly staffService = inject(RestaurantStaffService);
  private readonly authFacade = inject(AuthFacade);

  private readonly _restaurants = signal<RestaurantResponseDto[]>([]);
  private readonly _branches = signal<BranchResponseDto[]>([]);
  private readonly _currentRestaurantId = signal<string | null>(null);
  private readonly _currentBranchId = signal<string | null>(null);
  private readonly _currentRole = signal<RestaurantRole | null>(null);

  readonly restaurants = this._restaurants.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly currentRestaurantId = this._currentRestaurantId.asReadonly();
  readonly currentBranchId = this._currentBranchId.asReadonly();
  readonly currentRole = this._currentRole.asReadonly();

  readonly currentRestaurant = computed(
    () => this._restaurants().find((r) => r.id === this._currentRestaurantId()) ?? null,
  );

  readonly currentBranch = computed(
    () => this._branches().find((b) => b.id === this._currentBranchId()) ?? null,
  );

  private loadPromise: Promise<void> | null = null;

  /** Compatibility method for existing single-restaurant consumers. */
  async getRestaurantId(): Promise<string> {
    await this.ensureLoaded();

    const id = this._currentRestaurantId();

    if (!id) {
      throw new Error('No restaurant found for the current owner.');
    }

    return id;
  }

  async getBranchId(): Promise<string | undefined> {
    await this.ensureLoaded();
    return this._currentBranchId() ?? undefined;
  }

  /** Switches the active restaurant and reloads its branches/role — for a future
   *  multi-restaurant switcher UI. */
  async setCurrentRestaurant(restaurantId: string): Promise<void> {
    this._currentRestaurantId.set(restaurantId);
    await this.loadBranchesAndRole(restaurantId);
  }

  setCurrentBranch(branchId: string): void {
    this._currentBranchId.set(branchId);
  }

  hasRole(...roles: RestaurantRole[]): boolean {
    const role = this._currentRole();
    return !!role && roles.includes(role);
  }

  private ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.load().catch((error) => {
        this.loadPromise = null;
        throw error;
      });
    }

    return this.loadPromise;
  }

  private async load(): Promise<void> {
    const response = await this.restaurantsService.restaurantsControllerGetMyRestaurants();
    const restaurants = unwrap(response);

    this._restaurants.set(restaurants);

    const restaurant = restaurants[0];

    if (!restaurant) {
      throw new Error('No restaurant found for the current owner.');
    }

    this._currentRestaurantId.set(restaurant.id);
    await this.loadBranchesAndRole(restaurant.id);
  }

  private async loadBranchesAndRole(restaurantId: string): Promise<void> {
    const branchesResponse = await this.branchesService.branchesControllerFindAll({
      restaurantId,
    });
    const branches = unwrap(branchesResponse);

    this._branches.set(branches);

    const primary = branches.find((branch) => branch.isPrimary) ?? branches[0];
    this._currentBranchId.set(primary?.id ?? null);

    const restaurant = this._restaurants().find((r) => r.id === restaurantId);
    const userId = this.authFacade.user()?.id;

    if (restaurant && userId && restaurant.ownerId === userId) {
      this._currentRole.set('OWNER');
      return;
    }

    try {
      const staffResponse = await this.staffService.staffControllerFindAll({ restaurantId });
      const staff = unwrap(staffResponse);
      const mine = staff.find((member) => member.user?.id === userId);

      this._currentRole.set(mine?.role ?? null);
    } catch {
      this._currentRole.set(null);
    }
  }
}
