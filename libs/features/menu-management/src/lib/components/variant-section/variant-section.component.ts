import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { MenuItemResponseDto, MenuItemVariantResponseDto } from '@patheya-express-frontend/api-sdk';
import { VariantRowComponent } from '../variant-row/variant-row.component';
import { VariantFormComponent } from '../variant-form/variant-form.component';

@Component({
  selector: 'lib-variant-section',
  standalone: true,
  imports: [VariantRowComponent, VariantFormComponent],
  templateUrl: './variant-section.component.html',
  styleUrl: './variant-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantSectionComponent {
  @Input({ required: true }) item!: MenuItemResponseDto;

  /** 'create' for a new variant, a variant to edit, or null when the form is closed. */
  protected formTarget: 'create' | MenuItemVariantResponseDto | null = null;

  protected get isCreating(): boolean {
    return this.formTarget === 'create';
  }

  protected get editingVariant(): MenuItemVariantResponseDto | null {
    return this.formTarget && this.formTarget !== 'create' ? this.formTarget : null;
  }

  protected openCreate(): void {
    this.formTarget = 'create';
  }

  protected openEdit(variant: MenuItemVariantResponseDto): void {
    this.formTarget = variant;
  }

  protected closeForm(): void {
    this.formTarget = null;
  }
}
