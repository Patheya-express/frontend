import { Injectable, inject } from '@angular/core';
import {
  MenuService,
  type CreateMenuItemDto,
  type MenuCategoryResponseDto,
  type MenuItemResponseDto,
  type UpdateCategoryDto,
  type UpdateMenuItemDto,
} from '@patheya-express-frontend/api-sdk';
import { CurrentRestaurantService } from '@patheya-express-frontend/core';

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

/** Stateless backend orchestration for restaurant menu category/item management. */
@Injectable({ providedIn: 'root' })
export class MenuManagementService {
  private readonly menuService = inject(MenuService);
  private readonly currentRestaurant = inject(CurrentRestaurantService);

  async getMenu(): Promise<MenuCategoryResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.menuService.menuControllerGetRestaurantMenu({ restaurantId });
    return unwrap(response);
  }

  async createCategory(name: string, description?: string): Promise<MenuCategoryResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.menuService.menuControllerCreateCategory({
      body: { restaurantId, name, description },
    });
    return unwrap(response);
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto): Promise<MenuCategoryResponseDto> {
    const response = await this.menuService.menuControllerUpdateCategory({ id: categoryId, body: dto });
    return unwrap(response);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.menuService.menuControllerDeleteCategory({ id: categoryId });
  }

  async createMenuItem(dto: CreateMenuItemDto): Promise<MenuItemResponseDto> {
    const response = await this.menuService.menuControllerCreateMenuItem({ body: dto });
    return unwrap(response);
  }

  async updateMenuItem(itemId: string, dto: UpdateMenuItemDto): Promise<MenuItemResponseDto> {
    const response = await this.menuService.menuControllerUpdateMenuItem({ id: itemId, body: dto });
    return unwrap(response);
  }

  async deleteMenuItem(itemId: string): Promise<void> {
    await this.menuService.menuControllerDeleteMenuItem({ id: itemId });
  }

  async toggleAvailability(itemId: string, isAvailable: boolean): Promise<MenuItemResponseDto> {
    const response = await this.menuService.menuControllerToggleAvailability({
      id: itemId,
      body: { isAvailable },
    });
    return unwrap(response);
  }
}
