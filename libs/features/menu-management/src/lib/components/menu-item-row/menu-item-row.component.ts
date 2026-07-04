import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-menu-item-row',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './menu-item-row.component.html',
  styleUrl: './menu-item-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemRowComponent {
  @Input({ required: true }) item!: MenuItemResponseDto;
  @Output() editRequested = new EventEmitter<void>();

  private readonly facade = inject(MenuManagementFacade);

  protected deleteDialogOpen = false;

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.item.id;
  }

  protected toggleAvailability(): void {
    if (this.isProcessing) {
      return;
    }
    void this.facade.toggleAvailability(this.item.id, !this.item.isAvailable);
  }

  protected requestDelete(): void {
    this.deleteDialogOpen = true;
  }

  protected confirmDelete(): void {
    this.deleteDialogOpen = false;
    void this.facade.deleteMenuItem(this.item.id);
  }

  protected cancelDelete(): void {
    this.deleteDialogOpen = false;
  }
}
