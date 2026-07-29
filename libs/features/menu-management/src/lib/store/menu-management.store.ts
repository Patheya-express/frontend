import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  CreateMenuItemDto,
  MenuAddonResponseDto,
  MenuCategoryResponseDto,
  MenuItemResponseDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from '@patheya-express-frontend/api-sdk';
import { MenuManagementService } from '../services/menu-management.service';

export interface VariantFormValue {
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface AddonGroupFormValue {
  name: string;
  minSelection?: number;
  maxSelection?: number;
}

export interface AddonOptionFormValue {
  name: string;
  price: number;
  isAvailable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MenuManagementStore {
  private readonly menuManagementService = inject(MenuManagementService);

  private readonly _categories = signal<MenuCategoryResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);
  private readonly _validationErrors = signal<string[]>([]);
  private readonly _uploadingItemId = signal<string | null>(null);
  private readonly _uploadError = signal<string | null>(null);
  /** Retains the file from the most recent failed upload so `retryUpload()` can resubmit it without asking the user to re-select it — the native `<input type="file">` element clears its value after each selection, so the File object itself must be held here, not re-read from the DOM. Cleared on a successful upload or once a different item's upload is attempted. */
  private readonly _failedUpload = signal<{ itemId: string; file: File } | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();
  /** Client-side pre-flight validation messages (duplicate names, required fields, min/max, price) — set before a variant/add-on mutation is attempted, and cleared as soon as a subsequent attempt passes validation. Mutation failures reported by the API itself still go through `actionError`, not this. */
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly uploading = computed(() => this._uploadingItemId() !== null);
  readonly uploadError = this._uploadError.asReadonly();
  readonly canRetryUpload = computed(() => this._failedUpload() !== null);

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

  dismissValidationErrors(): void {
    this._validationErrors.set([]);
  }

  // --- Media ------------------------------------------------------------

  async uploadImage(itemId: string, file: File): Promise<void> {
    this._uploadingItemId.set(itemId);
    this._uploadError.set(null);

    try {
      await this.menuManagementService.uploadImage(itemId, file);
      await this.loadMenu();
      this._failedUpload.set(null);
    } catch {
      this._uploadError.set('Unable to upload image. Please try again.');
      this._failedUpload.set({ itemId, file });
    } finally {
      this._uploadingItemId.set(null);
    }
  }

  retryUpload(): Promise<void> {
    const pending = this._failedUpload();
    if (!pending) {
      return Promise.resolve();
    }
    return this.uploadImage(pending.itemId, pending.file);
  }

  async removeImage(itemId: string): Promise<void> {
    this._uploadingItemId.set(itemId);
    this._uploadError.set(null);

    try {
      await this.menuManagementService.updateMenuItem(itemId, { imageUrl: '' });
      await this.loadMenu();
    } catch {
      this._uploadError.set('Unable to remove image. Please try again.');
    } finally {
      this._uploadingItemId.set(null);
    }
  }

  dismissUploadError(): void {
    this._uploadError.set(null);
    this._failedUpload.set(null);
  }

  // --- Variants ---------------------------------------------------------
  // The backend models a menu item's variants as a single flat list directly on the item
  // (MenuItemVariant: name + price + isDefault) — there is no separate "variant group" entity
  // distinguishing, say, a "Size" group from its "Small/Medium/Large" options. Each variant row
  // already *is* what a two-level model would call an "option"; restaurant owners convey any
  // grouping through the name itself (e.g. "Size: Small").

  createVariant(itemId: string, value: VariantFormValue): Promise<void> {
    const errors = this.validateVariant(value, itemId);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return Promise.resolve();
    }

    this._validationErrors.set([]);
    return this.runMutation(`new-variant-${itemId}`, async () => {
      if (value.isDefault) {
        await this.demoteDefaultVariants(itemId);
      }
      await this.menuManagementService.createVariant(itemId, value);
    });
  }

  updateVariant(variantId: string, itemId: string, value: VariantFormValue): Promise<void> {
    const errors = this.validateVariant(value, itemId, variantId);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return Promise.resolve();
    }

    this._validationErrors.set([]);
    return this.runMutation(variantId, async () => {
      if (value.isDefault) {
        await this.demoteDefaultVariants(itemId, variantId);
      }
      await this.menuManagementService.updateVariant(variantId, value);
    });
  }

  deleteVariant(variantId: string): Promise<void> {
    return this.runMutation(variantId, () => this.menuManagementService.deleteVariant(variantId));
  }

  /**
   * Only one variant may be the default at a time, but the backend doesn't enforce that
   * invariant (no unique constraint) — so marking a variant as default here also demotes
   * whichever other variant currently holds it, via a second real API call, rather than leaving
   * two variants simultaneously flagged `isDefault: true`.
   */
  private async demoteDefaultVariants(itemId: string, excludeVariantId?: string): Promise<void> {
    const currentDefaults = (this.findItem(itemId)?.variants ?? []).filter(
      (variant) => variant.isDefault && variant.id !== excludeVariantId,
    );

    for (const variant of currentDefaults) {
      await this.menuManagementService.updateVariant(variant.id, { isDefault: false });
    }
  }

  // --- Add-on groups + options --------------------------------------------

  createAddonGroup(itemId: string, value: AddonGroupFormValue): Promise<void> {
    const errors = this.validateAddonGroup(value, itemId);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return Promise.resolve();
    }

    this._validationErrors.set([]);
    return this.runMutation(`new-addon-${itemId}`, () => this.menuManagementService.createAddonGroup(itemId, value));
  }

  updateAddonGroup(addonId: string, itemId: string, value: AddonGroupFormValue): Promise<void> {
    const errors = this.validateAddonGroup(value, itemId, addonId);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return Promise.resolve();
    }

    this._validationErrors.set([]);
    return this.runMutation(addonId, () => this.menuManagementService.updateAddonGroup(addonId, value));
  }

  deleteAddonGroup(addonId: string): Promise<void> {
    return this.runMutation(addonId, () => this.menuManagementService.deleteAddonGroup(addonId));
  }

  createAddonOption(addonId: string, value: AddonOptionFormValue): Promise<void> {
    const errors = this.validateAddonOption(value, addonId);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return Promise.resolve();
    }

    this._validationErrors.set([]);
    return this.runMutation(`new-option-${addonId}`, () =>
      this.menuManagementService.createAddonOption(addonId, value),
    );
  }

  updateAddonOption(optionId: string, addonId: string, value: AddonOptionFormValue): Promise<void> {
    const errors = this.validateAddonOption(value, addonId, optionId);
    if (errors.length > 0) {
      this._validationErrors.set(errors);
      return Promise.resolve();
    }

    this._validationErrors.set([]);
    return this.runMutation(optionId, () => this.menuManagementService.updateAddonOption(optionId, value));
  }

  deleteAddonOption(optionId: string): Promise<void> {
    return this.runMutation(optionId, () => this.menuManagementService.deleteAddonOption(optionId));
  }

  // --- Validation -----------------------------------------------------------

  private validateVariant(value: VariantFormValue, itemId: string, excludeId?: string): string[] {
    const errors: string[] = [];
    const name = value.name.trim();

    if (!name) {
      errors.push('Variant name is required.');
    }

    if (value.price < 0) {
      errors.push('Variant price cannot be negative.');
    }

    if (name) {
      const siblings = this.findItem(itemId)?.variants ?? [];
      const isDuplicate = siblings.some(
        (variant) => variant.id !== excludeId && variant.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (isDuplicate) {
        errors.push(`A variant named "${name}" already exists on this item.`);
      }
    }

    return errors;
  }

  private validateAddonGroup(value: AddonGroupFormValue, itemId: string, excludeId?: string): string[] {
    const errors: string[] = [];
    const name = value.name.trim();
    const minSelection = value.minSelection ?? 0;
    const maxSelection = value.maxSelection ?? 1;

    if (!name) {
      errors.push('Add-on group name is required.');
    }

    if (minSelection < 0) {
      errors.push('Minimum selection cannot be negative.');
    }

    if (maxSelection < 1) {
      errors.push('Maximum selection must be at least 1.');
    }

    if (minSelection > maxSelection) {
      errors.push('Minimum selection cannot exceed maximum selection.');
    }

    if (name) {
      const siblings = this.findItem(itemId)?.addons ?? [];
      const isDuplicate = siblings.some(
        (addon) => addon.id !== excludeId && addon.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (isDuplicate) {
        errors.push(`An add-on group named "${name}" already exists on this item.`);
      }
    }

    return errors;
  }

  private validateAddonOption(value: AddonOptionFormValue, addonId: string, excludeId?: string): string[] {
    const errors: string[] = [];
    const name = value.name.trim();

    if (!name) {
      errors.push('Add-on option name is required.');
    }

    if (value.price < 0) {
      errors.push('Add-on option price cannot be negative.');
    }

    if (name) {
      const siblings = this.findAddonGroup(addonId)?.options ?? [];
      const isDuplicate = siblings.some(
        (option) => option.id !== excludeId && option.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (isDuplicate) {
        errors.push(`An option named "${name}" already exists in this add-on group.`);
      }
    }

    return errors;
  }

  private findItem(itemId: string): MenuItemResponseDto | undefined {
    for (const category of this._categories()) {
      const item = category.menuItems.find((candidate) => candidate.id === itemId);
      if (item) {
        return item;
      }
    }
    return undefined;
  }

  private findAddonGroup(addonId: string): MenuAddonResponseDto | undefined {
    for (const category of this._categories()) {
      for (const item of category.menuItems) {
        const addon = item.addons.find((candidate) => candidate.id === addonId);
        if (addon) {
          return addon;
        }
      }
    }
    return undefined;
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
