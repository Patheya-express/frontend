import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';

@Component({
  selector: 'lib-restaurant-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './restaurant-card.component.html',
  styleUrl: './restaurant-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantCardComponent {
  @Input({ required: true }) restaurant!: RestaurantResponseDto;
}
