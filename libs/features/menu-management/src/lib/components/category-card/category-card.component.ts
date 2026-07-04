import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { MenuCategoryResponseDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';
import { MenuItemRowComponent } from '../menu-item-row/menu-item-row.component';

@Component({
  selector: 'lib-category-card',
  standalone: true,
  imports: [ConfirmDialogComponent, MenuItemRowComponent],
  templateUrl: './category-card.component.html',
  styleUrl: './category-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryCardComponent {
  @Input({ required: true }) category!: MenuCategoryResponseDto;
  @Output() editRequested = new EventEmitter<void>();
  @Output() addItemRequested = new EventEmitter<void>();
  @Output() editItemRequested = new EventEmitter<string>();

  private readonly facade = inject(MenuManagementFacade);

  protected deleteDialogOpen = false;

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.category.id;
  }

  protected requestDelete(): void {
    this.deleteDialogOpen = true;
  }

  protected confirmDelete(): void {
    this.deleteDialogOpen = false;
    void this.facade.deleteCategory(this.category.id);
  }

  protected cancelDelete(): void {
    this.deleteDialogOpen = false;
  }
}
