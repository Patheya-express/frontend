import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MenuAddonResponseDto } from '@patheya-express-frontend/api-sdk';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-addon-group-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './addon-group-form.component.html',
  styleUrl: './addon-group-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonGroupFormComponent implements OnInit {
  /** The item this add-on group belongs to (or will be created under). */
  @Input({ required: true }) itemId!: string;
  /** Omit to create a new group; provide to edit an existing one. */
  @Input() group?: MenuAddonResponseDto;
  @Output() closed = new EventEmitter<void>();

  protected readonly facade = inject(MenuManagementFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    minSelection: [0, [Validators.required, Validators.min(0)]],
    maxSelection: [1, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    if (this.group) {
      this.form.patchValue({
        name: this.group.name,
        minSelection: this.group.minSelection,
        maxSelection: this.group.maxSelection,
      });
    }
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === (this.group?.id ?? `new-addon-${this.itemId}`);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const { name, minSelection, maxSelection } = this.form.getRawValue();
    const value = { name: name ?? '', minSelection: minSelection ?? 0, maxSelection: maxSelection ?? 1 };

    if (this.group) {
      await this.facade.updateAddonGroup(this.group.id, this.itemId, value);
    } else {
      await this.facade.createAddonGroup(this.itemId, value);
    }

    if (this.facade.validationErrors().length === 0) {
      this.closed.emit();
    }
  }

  protected cancel(): void {
    this.facade.dismissValidationErrors();
    this.closed.emit();
  }
}
