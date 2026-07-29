import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MenuAddonOptionResponseDto } from '@patheya-express-frontend/api-sdk';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-addon-option-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './addon-option-form.component.html',
  styleUrl: './addon-option-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonOptionFormComponent implements OnInit {
  /** The add-on group this option belongs to (or will be created under). */
  @Input({ required: true }) addonId!: string;
  /** Omit to create a new option; provide to edit an existing one. */
  @Input() option?: MenuAddonOptionResponseDto;
  @Output() closed = new EventEmitter<void>();

  protected readonly facade = inject(MenuManagementFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    isAvailable: [true],
  });

  ngOnInit(): void {
    if (this.option) {
      this.form.patchValue({
        name: this.option.name,
        price: Number(this.option.price),
        isAvailable: this.option.isAvailable,
      });
    }
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === (this.option?.id ?? `new-option-${this.addonId}`);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const { name, price, isAvailable } = this.form.getRawValue();
    const value = { name: name ?? '', price: price ?? 0, isAvailable: isAvailable ?? true };

    if (this.option) {
      await this.facade.updateAddonOption(this.option.id, this.addonId, value);
    } else {
      await this.facade.createAddonOption(this.addonId, value);
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
