import { Injectable, inject } from '@angular/core';
import type { CreateMenuItemDto, UpdateCategoryDto, UpdateMenuItemDto } from '@patheya-express-frontend/api-sdk';
import { MenuManagementStore } from '../store/menu-management.store';

@Injectable({ providedIn: 'root' })
export class MenuManagementFacade {
  private readonly store = inject(MenuManagementStore);

  readonly categories = this.store.categories;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  initialize(): Promise<void> {
    return this.store.loadMenu();
  }

  refresh(): Promise<void> {
    return this.store.loadMenu();
  }

  createCategory(name: string, description?: string): Promise<void> {
    return this.store.createCategory(name, description);
  }

  updateCategory(categoryId: string, dto: UpdateCategoryDto): Promise<void> {
    return this.store.updateCategory(categoryId, dto);
  }

  deleteCategory(categoryId: string): Promise<void> {
    return this.store.deleteCategory(categoryId);
  }

  createMenuItem(dto: CreateMenuItemDto): Promise<void> {
    return this.store.createMenuItem(dto);
  }

  updateMenuItem(itemId: string, dto: UpdateMenuItemDto): Promise<void> {
    return this.store.updateMenuItem(itemId, dto);
  }

  deleteMenuItem(itemId: string): Promise<void> {
    return this.store.deleteMenuItem(itemId);
  }

  toggleAvailability(itemId: string, isAvailable: boolean): Promise<void> {
    return this.store.toggleAvailability(itemId, isAvailable);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
