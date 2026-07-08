import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';

@Component({
  selector: 'lib-menu-item-customization-sheet',
  standalone: true,
  templateUrl: './menu-item-customization-sheet.component.html',
  styleUrl: './menu-item-customization-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemCustomizationSheetComponent implements OnInit {
  @Input({ required: true }) item!: MenuItemResponseDto;
  @Input({ required: true }) restaurantName!: string;
  @Output() closed = new EventEmitter<void>();

  private readonly cartFacade = inject(CartFacade);

  protected readonly selectedVariantId = signal<string | undefined>(undefined);
  protected readonly selectedOptionIds = signal<Set<string>>(new Set());
  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);

  ngOnInit(): void {
    const defaultVariant = this.item.variants.find((variant) => variant.isDefault) ?? this.item.variants[0];
    if (defaultVariant) {
      this.selectedVariantId.set(defaultVariant.id);
    }
  }

  protected readonly unitPrice = computed(() => {
    const variant = this.item.variants.find((v) => v.id === this.selectedVariantId());
    return variant ? variant.price : this.item.basePrice;
  });

  protected readonly addonsTotal = computed(() => {
    const selected = this.selectedOptionIds();
    let total = 0;
    for (const addon of this.item.addons) {
      for (const option of addon.options) {
        if (selected.has(option.id)) {
          total += option.price;
        }
      }
    }
    return total;
  });

  protected readonly totalPrice = computed(() => (this.unitPrice() + this.addonsTotal()) * this.quantity());

  protected readonly isValid = computed(() => {
    const selected = this.selectedOptionIds();
    return this.item.addons.every((addon) => {
      const selectedCount = addon.options.filter((option) => selected.has(option.id)).length;
      return selectedCount >= addon.minSelection && selectedCount <= addon.maxSelection;
    });
  });

  protected selectVariant(variantId: string): void {
    this.selectedVariantId.set(variantId);
  }

  protected selectedCountForAddon(addonId: string): number {
    const addon = this.item.addons.find((a) => a.id === addonId);
    if (!addon) {
      return 0;
    }
    const selected = this.selectedOptionIds();
    return addon.options.filter((option) => selected.has(option.id)).length;
  }

  protected toggleOption(addonId: string, optionId: string, maxSelection: number): void {
    const addon = this.item.addons.find((a) => a.id === addonId);
    if (!addon) {
      return;
    }

    const next = new Set(this.selectedOptionIds());

    if (next.has(optionId)) {
      next.delete(optionId);
    } else {
      if (maxSelection === 1) {
        for (const option of addon.options) {
          next.delete(option.id);
        }
      } else if (this.selectedCountForAddon(addonId) >= maxSelection) {
        return;
      }
      next.add(optionId);
    }

    this.selectedOptionIds.set(next);
  }

  protected increaseQuantity(): void {
    this.quantity.update((q) => q + 1);
  }

  protected decreaseQuantity(): void {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  protected close(): void {
    this.closed.emit();
  }

  protected async addToCart(): Promise<void> {
    if (!this.isValid()) {
      return;
    }

    this.adding.set(true);

    await this.cartFacade.addItem({
      menuItemId: this.item.id,
      variantId: this.selectedVariantId(),
      addonOptionIds: [...this.selectedOptionIds()],
      quantity: this.quantity(),
      restaurantName: this.restaurantName,
    });

    this.adding.set(false);
    this.closed.emit();
  }
}
