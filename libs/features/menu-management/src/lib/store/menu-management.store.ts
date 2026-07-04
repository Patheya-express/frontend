import { Injectable, inject, signal } from '@angular/core';
import type {
  CreateMenuItemDto,
  MenuCategoryResponseDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from '@patheya-express-frontend/api-sdk';
import { MenuManagementService } from '../services/menu-management.service';

@Injectable({ providedIn: 'root' })
export class MenuManagementStore {
  private readonly menuManagementService = inject(MenuManagementService);

  private readonly _categories = signal<MenuCategoryResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  async loadMenu(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const categories = await this.menuManagementService.getMenu();
      this._categories.set(categories);
    } catch {
      this._error.set('Unable to load the menu. Please try again.');
      this._categories.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  createCategory(name: string, description?: string): Promise<void> {
    return this.runMutation('new-category', () => this.menuManagementService.createCategory(name, description));
  }

  updateCategory(categoryId: string, dto: UpdateCategoryDto): Promise<void> {
    return this.runMutation(categoryId, () => this.menuManagementService.updateCategory(categoryId, dto));
  }

  deleteCategory(categoryId: string): Promise<void> {
    return this.runMutation(categoryId, () => this.menuManagementService.deleteCategory(categoryId));
  }

  createMenuItem(dto: CreateMenuItemDto): Promise<void> {
    return this.runMutation(`new-item-${dto.categoryId}`, () => this.menuManagementService.createMenuItem(dto));
  }

  updateMenuItem(itemId: string, dto: UpdateMenuItemDto): Promise<void> {
    return this.runMutation(itemId, () => this.menuManagementService.updateMenuItem(itemId, dto));
  }

  deleteMenuItem(itemId: string): Promise<void> {
    return this.runMutation(itemId, () => this.menuManagementService.deleteMenuItem(itemId));
  }

  toggleAvailability(itemId: string, isAvailable: boolean): Promise<void> {
    return this.runMutation(itemId, () => this.menuManagementService.toggleAvailability(itemId, isAvailable));
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * Runs a single mutation, then reloads the whole menu tree on success. Categories/items
   * form a nested structure, so re-fetching is simpler and safer than patching individual
   * nodes in place — this is a CRUD management screen, not a live/polling feed.
   */
  private async runMutation(id: string, action: () => Promise<unknown>): Promise<void> {
    this._processingId.set(id);
    this._actionError.set(null);

    try {
      await action();
      await this.loadMenu();
    } catch {
      this._actionError.set('Unable to save your changes. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }
}
