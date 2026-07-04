import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-menu-item-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './menu-item-form.component.html',
  styleUrl: './menu-item-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemFormComponent implements OnInit {
  /** The category this item belongs to (or will be created under). */
  @Input({ required: true }) categoryId!: string;
  /** Omit to create a new item; provide to edit an existing one. */
  @Input() item?: MenuItemResponseDto;
  @Output() closed = new EventEmitter<void>();

  private readonly facade = inject(MenuManagementFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    description: [''],
    basePrice: [0, [Validators.required, Validators.min(0)]],
    isVegetarian: [false],
    isVegan: [false],
  });

  ngOnInit(): void {
    if (this.item) {
      // basePrice comes back from the API as a numeric string (a Prisma Decimal
      // serialization quirk) even though the SDK types it as `number` — coerce it here so
      // the price control always holds a real number, matching what the number input
      // itself produces when a user types into it.
      this.form.patchValue({
        name: this.item.name,
        description: this.item.description ?? '',
        basePrice: Number(this.item.basePrice),
        isVegetarian: this.item.isVegetarian,
        isVegan: this.item.isVegan,
      });
    }
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === (this.item?.id ?? `new-item-${this.categoryId}`);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const { name, description, basePrice, isVegetarian, isVegan } = this.form.getRawValue();

    if (this.item) {
      await this.facade.updateMenuItem(this.item.id, {
        name: name ?? undefined,
        description: description || undefined,
        basePrice: basePrice ?? undefined,
        isVegetarian: isVegetarian ?? undefined,
        isVegan: isVegan ?? undefined,
      });
    } else {
      await this.facade.createMenuItem({
        categoryId: this.categoryId,
        name: name ?? '',
        description: description || undefined,
        basePrice: basePrice ?? 0,
        isVegetarian: isVegetarian ?? undefined,
        isVegan: isVegan ?? undefined,
      });
    }

    this.closed.emit();
  }

  protected cancel(): void {
    this.closed.emit();
  }
}
