import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed } from '@angular/core';
import type { AddressResponseDto } from '@patheya-express-frontend/api-sdk';

@Component({
  selector: 'lib-address-card',
  standalone: true,
  templateUrl: './address-card.component.html',
  styleUrl: './address-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressCardComponent {
  @Input({ required: true }) address!: AddressResponseDto;
  @Input() selected = false;
  @Input() selectable = true;

  @Output() addressSelected = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();
  @Output() setDefault = new EventEmitter<string>();

  protected readonly displayLabel = computed(() => {
    const address = this.address;
    if (address.label === 'OTHER' && address.customLabel) {
      return address.customLabel;
    }
    return address.label === 'HOME' ? 'Home' : address.label === 'WORK' ? 'Work' : 'Other';
  });

  protected onSelect(): void {
    if (this.selectable) {
      this.addressSelected.emit(this.address.id);
    }
  }
}
