import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MenuItemVariantResponseDto } from '@patheya-express-frontend/api-sdk';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-variant-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './variant-form.component.html',
  styleUrl: './variant-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantFormComponent implements OnInit {
  /** The item this variant belongs to (or will be created under). */
  @Input({ required: true }) itemId!: string;
  /** Omit to create a new variant; provide to edit an existing one. */
  @Input() variant?: MenuItemVariantResponseDto;
  @Output() closed = new EventEmitter<void>();

  protected readonly facade = inject(MenuManagementFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    isDefault: [false],
  });

  ngOnInit(): void {
    if (this.variant) {
      // price comes back from the API as a numeric string (Prisma Decimal serialization),
      // even though the SDK types it as `number` — coerce it, matching menu-item-form's basePrice.
      this.form.patchValue({
        name: this.variant.name,
        price: Number(this.variant.price),
        isDefault: this.variant.isDefault,
      });
    }
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === (this.variant?.id ?? `new-variant-${this.itemId}`);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const { name, price, isDefault } = this.form.getRawValue();
    const value = { name: name ?? '', price: price ?? 0, isDefault: isDefault ?? false };

    if (this.variant) {
      await this.facade.updateVariant(this.variant.id, this.itemId, value);
    } else {
      await this.facade.createVariant(this.itemId, value);
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
