import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { MenuAddonOptionResponseDto, MenuAddonResponseDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent, StatusChipComponent } from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';
import { AddonOptionRowComponent } from '../addon-option-row/addon-option-row.component';
import { AddonOptionFormComponent } from '../addon-option-form/addon-option-form.component';

@Component({
  selector: 'lib-addon-group-card',
  standalone: true,
  imports: [ConfirmDialogComponent, StatusChipComponent, AddonOptionRowComponent, AddonOptionFormComponent],
  templateUrl: './addon-group-card.component.html',
  styleUrl: './addon-group-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonGroupCardComponent {
  @Input({ required: true }) group!: MenuAddonResponseDto;
  @Output() editRequested = new EventEmitter<void>();

  private readonly facade = inject(MenuManagementFacade);

  protected deleteDialogOpen = false;
  /** 'create' for a new option, an option to edit, or null when the form is closed. */
  protected optionFormTarget: 'create' | MenuAddonOptionResponseDto | null = null;

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.group.id;
  }

  protected get isRequired(): boolean {
    return this.group.minSelection > 0;
  }

  protected requestDelete(): void {
    this.deleteDialogOpen = true;
  }

  protected confirmDelete(): void {
    this.deleteDialogOpen = false;
    void this.facade.deleteAddonGroup(this.group.id);
  }

  protected cancelDelete(): void {
    this.deleteDialogOpen = false;
  }

  protected get isCreatingOption(): boolean {
    return this.optionFormTarget === 'create';
  }

  protected get editingOption(): MenuAddonOptionResponseDto | null {
    return this.optionFormTarget && this.optionFormTarget !== 'create' ? this.optionFormTarget : null;
  }

  protected openCreateOption(): void {
    this.optionFormTarget = 'create';
  }

  protected openEditOption(option: MenuAddonOptionResponseDto): void {
    this.optionFormTarget = option;
  }

  protected closeOptionForm(): void {
    this.optionFormTarget = null;
  }
}
