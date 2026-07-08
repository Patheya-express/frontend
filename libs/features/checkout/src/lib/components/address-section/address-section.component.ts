import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AddressPickerComponent } from '@patheya-express-frontend/addresses';

@Component({
  selector: 'lib-address-section',
  standalone: true,
  imports: [AddressPickerComponent],
  templateUrl: './address-section.component.html',
  styleUrl: './address-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressSectionComponent {}
