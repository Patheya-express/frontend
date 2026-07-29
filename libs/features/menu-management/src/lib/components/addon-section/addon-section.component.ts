import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { MenuAddonResponseDto, MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { AddonGroupCardComponent } from '../addon-group-card/addon-group-card.component';
import { AddonGroupFormComponent } from '../addon-group-form/addon-group-form.component';

@Component({
  selector: 'lib-addon-section',
  standalone: true,
  imports: [AddonGroupCardComponent, AddonGroupFormComponent],
  templateUrl: './addon-section.component.html',
  styleUrl: './addon-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonSectionComponent {
  @Input({ required: true }) item!: MenuItemResponseDto;

  /** 'create' for a new add-on group, a group to edit, or null when the form is closed. */
  protected formTarget: 'create' | MenuAddonResponseDto | null = null;

  protected get isCreating(): boolean {
    return this.formTarget === 'create';
  }

  protected get editingGroup(): MenuAddonResponseDto | null {
    return this.formTarget && this.formTarget !== 'create' ? this.formTarget : null;
  }

  protected openCreate(): void {
    this.formTarget = 'create';
  }

  protected openEdit(group: MenuAddonResponseDto): void {
    this.formTarget = group;
  }

  protected closeForm(): void {
    this.formTarget = null;
  }
}
