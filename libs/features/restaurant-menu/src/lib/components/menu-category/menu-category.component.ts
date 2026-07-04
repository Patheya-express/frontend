import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { MenuCategoryResponseDto } from '@patheya-express-frontend/api-sdk';
import { MenuItemCardComponent } from '../menu-item-card/menu-item-card.component';

@Component({
  selector: 'lib-menu-category',
  standalone: true,
  imports: [MenuItemCardComponent],
  templateUrl: './menu-category.component.html',
  styleUrl: './menu-category.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuCategoryComponent {
  @Input({ required: true }) category!: MenuCategoryResponseDto;
  @Input({ required: true }) restaurantId!: string;
  @Input({ required: true }) restaurantName!: string;
}
