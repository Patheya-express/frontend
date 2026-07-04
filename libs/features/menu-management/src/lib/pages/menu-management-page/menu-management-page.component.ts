import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import type { MenuCategoryResponseDto, MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';
import { CategoryCardComponent } from '../../components/category-card/category-card.component';
import { CategoryFormComponent } from '../../components/category-form/category-form.component';
import { MenuItemFormComponent } from '../../components/menu-item-form/menu-item-form.component';

interface ItemFormTarget {
  categoryId: string;
  item: MenuItemResponseDto | null;
}

@Component({
  selector: 'lib-menu-management-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    CategoryCardComponent,
    CategoryFormComponent,
    MenuItemFormComponent,
  ],
  templateUrl: './menu-management-page.component.html',
  styleUrl: './menu-management-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuManagementPageComponent implements OnInit {
  private readonly facade = inject(MenuManagementFacade);

  protected readonly categories = this.facade.categories;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly actionError = this.facade.actionError;

  /** 'create' for a new category, a category to edit, or null when the form is closed. */
  protected categoryFormTarget: 'create' | MenuCategoryResponseDto | null = null;
  protected itemFormTarget: ItemFormTarget | null = null;

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected dismissActionError(): void {
    this.facade.dismissActionError();
  }

  protected get isCreatingCategory(): boolean {
    return this.categoryFormTarget === 'create';
  }

  protected get editingCategory(): MenuCategoryResponseDto | null {
    return this.categoryFormTarget && this.categoryFormTarget !== 'create' ? this.categoryFormTarget : null;
  }

  protected openCreateCategory(): void {
    this.categoryFormTarget = 'create';
  }

  protected openEditCategory(category: MenuCategoryResponseDto): void {
    this.categoryFormTarget = category;
  }

  protected closeCategoryForm(): void {
    this.categoryFormTarget = null;
  }

  protected openAddItem(categoryId: string): void {
    this.itemFormTarget = { categoryId, item: null };
  }

  protected openEditItem(category: MenuCategoryResponseDto, itemId: string): void {
    const item = category.menuItems.find((candidate) => candidate.id === itemId) ?? null;
    this.itemFormTarget = { categoryId: category.id, item };
  }

  protected closeItemForm(): void {
    this.itemFormTarget = null;
  }
}
