import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { MenuAddonOptionResponseDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-addon-option-row',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './addon-option-row.component.html',
  styleUrl: './addon-option-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonOptionRowComponent {
  @Input({ required: true }) option!: MenuAddonOptionResponseDto;
  @Output() editRequested = new EventEmitter<void>();

  private readonly facade = inject(MenuManagementFacade);

  protected deleteDialogOpen = false;

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.option.id;
  }

  protected toggleAvailability(): void {
    if (this.isProcessing) {
      return;
    }
    void this.facade.updateAddonOption(this.option.id, this.option.addonId, {
      name: this.option.name,
      price: Number(this.option.price),
      isAvailable: !this.option.isAvailable,
    });
  }

  protected requestDelete(): void {
    this.deleteDialogOpen = true;
  }

  protected confirmDelete(): void {
    this.deleteDialogOpen = false;
    void this.facade.deleteAddonOption(this.option.id);
  }

  protected cancelDelete(): void {
    this.deleteDialogOpen = false;
  }
}
