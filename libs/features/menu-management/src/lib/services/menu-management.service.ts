import { Injectable, inject } from '@angular/core';
import {
  MenuService,
  type CreateMenuItemDto,
  type MenuAddonOptionResponseDto,
  type MenuAddonResponseDto,
  type MenuCategoryResponseDto,
  type MenuItemResponseDto,
  type MenuItemVariantResponseDto,
  type UpdateCategoryDto,
  type UpdateMenuItemDto,
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

// The backend's CreateMenuItemVariantDto/UpdateMenuItemVariantDto, Create/UpdateAddonDto, and
// Create/UpdateAddonOptionDto classes validate real fields at runtime (class-validator) but were
// never annotated with @nestjs/swagger's @ApiProperty(), so their generated OpenAPI schemas — and
// therefore these SDK model types — are empty `{}` interfaces. These local interfaces describe
// the real request shape (confirmed against the backend DTO source) so call sites here stay
// accurately typed despite the generated types being uninformative. Not a modification of any
// generated file.
interface VariantWriteRequest {
  name?: string;
  price?: number;
  isDefault?: boolean;
}

interface AddonGroupWriteRequest {
  name?: string;
  minSelection?: number;
  maxSelection?: number;
}

interface AddonOptionWriteRequest {
  name?: string;
  price?: number;
  isAvailable?: boolean;
}

/** Stateless backend orchestration for restaurant menu category/item management. */
@Injectable({ providedIn: 'root' })
export class MenuManagementService {
  private readonly menuService = inject(MenuService);
  private readonly currentRestaurant = inject(RestaurantContextService);

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

  async createVariant(itemId: string, dto: VariantWriteRequest): Promise<MenuItemVariantResponseDto> {
    const response = await this.menuService.menuControllerCreateVariant({ id: itemId, body: dto });
    return unwrap(response);
  }

  async updateVariant(variantId: string, dto: VariantWriteRequest): Promise<MenuItemVariantResponseDto> {
    const response = await this.menuService.menuControllerUpdateVariant({ id: variantId, body: dto });
    return unwrap(response);
  }

  async deleteVariant(variantId: string): Promise<void> {
    await this.menuService.menuControllerDeleteVariant({ id: variantId });
  }

  async createAddonGroup(itemId: string, dto: AddonGroupWriteRequest): Promise<MenuAddonResponseDto> {
    const response = await this.menuService.menuControllerCreateAddon({ id: itemId, body: dto });
    return unwrap(response);
  }

  async updateAddonGroup(addonId: string, dto: AddonGroupWriteRequest): Promise<MenuAddonResponseDto> {
    const response = await this.menuService.menuControllerUpdateAddon({ id: addonId, body: dto });
    return unwrap(response);
  }

  async deleteAddonGroup(addonId: string): Promise<void> {
    await this.menuService.menuControllerDeleteAddon({ id: addonId });
  }

  async createAddonOption(addonId: string, dto: AddonOptionWriteRequest): Promise<MenuAddonOptionResponseDto> {
    const response = await this.menuService.menuControllerCreateAddonOption({ id: addonId, body: dto });
    return unwrap(response);
  }

  async updateAddonOption(optionId: string, dto: AddonOptionWriteRequest): Promise<MenuAddonOptionResponseDto> {
    const response = await this.menuService.menuControllerUpdateAddonOption({ id: optionId, body: dto });
    return unwrap(response);
  }

  async deleteAddonOption(optionId: string): Promise<void> {
    await this.menuService.menuControllerDeleteAddonOption({ id: optionId });
  }

  async uploadImage(itemId: string, file: File): Promise<MenuItemResponseDto> {
    const response = await this.menuService.menuControllerUploadMenuItemImage({ id: itemId, body: { file } });
    return unwrap(response);
  }
}
