import { Injectable, computed, inject } from '@angular/core';
import type { CreateMenuItemDto, UpdateCategoryDto, UpdateMenuItemDto } from '@patheya-express-frontend/api-sdk';
import {
  MenuManagementStore,
  type AddonGroupFormValue,
  type AddonOptionFormValue,
  type VariantFormValue,
} from '../store/menu-management.store';

@Injectable({ providedIn: 'root' })
export class MenuManagementFacade {
  private readonly store = inject(MenuManagementStore);

  readonly categories = this.store.categories;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;
  readonly validationErrors = this.store.validationErrors;
  /** True while any variant/add-on/category/item mutation is in flight. */
  readonly saving = computed(() => this.store.processingId() !== null);
  readonly uploading = this.store.uploading;
  readonly uploadError = this.store.uploadError;
  readonly canRetryUpload = this.store.canRetryUpload;

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

  dismissValidationErrors(): void {
    this.store.dismissValidationErrors();
  }

  createVariant(itemId: string, value: VariantFormValue): Promise<void> {
    return this.store.createVariant(itemId, value);
  }

  updateVariant(variantId: string, itemId: string, value: VariantFormValue): Promise<void> {
    return this.store.updateVariant(variantId, itemId, value);
  }

  deleteVariant(variantId: string): Promise<void> {
    return this.store.deleteVariant(variantId);
  }

  createAddonGroup(itemId: string, value: AddonGroupFormValue): Promise<void> {
    return this.store.createAddonGroup(itemId, value);
  }

  updateAddonGroup(addonId: string, itemId: string, value: AddonGroupFormValue): Promise<void> {
    return this.store.updateAddonGroup(addonId, itemId, value);
  }

  deleteAddonGroup(addonId: string): Promise<void> {
    return this.store.deleteAddonGroup(addonId);
  }

  createAddonOption(addonId: string, value: AddonOptionFormValue): Promise<void> {
    return this.store.createAddonOption(addonId, value);
  }

  updateAddonOption(optionId: string, addonId: string, value: AddonOptionFormValue): Promise<void> {
    return this.store.updateAddonOption(optionId, addonId, value);
  }

  deleteAddonOption(optionId: string): Promise<void> {
    return this.store.deleteAddonOption(optionId);
  }

  uploadImage(itemId: string, file: File): Promise<void> {
    return this.store.uploadImage(itemId, file);
  }

  removeImage(itemId: string): Promise<void> {
    return this.store.removeImage(itemId);
  }

  retryUpload(): Promise<void> {
    return this.store.retryUpload();
  }

  dismissUploadError(): void {
    this.store.dismissUploadError();
  }
}
