import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { MenuItemVariantResponseDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-variant-row',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './variant-row.component.html',
  styleUrl: './variant-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantRowComponent {
  @Input({ required: true }) variant!: MenuItemVariantResponseDto;
  @Output() editRequested = new EventEmitter<void>();

  private readonly facade = inject(MenuManagementFacade);

  protected deleteDialogOpen = false;

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.variant.id;
  }

  protected requestDelete(): void {
    this.deleteDialogOpen = true;
  }

  protected confirmDelete(): void {
    this.deleteDialogOpen = false;
    void this.facade.deleteVariant(this.variant.id);
  }

  protected cancelDelete(): void {
    this.deleteDialogOpen = false;
  }
}
