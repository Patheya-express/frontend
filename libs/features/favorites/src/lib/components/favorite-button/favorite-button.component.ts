import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { FavoritesFacade } from '../../facades/favorites.facade';

export type FavoriteTargetType = 'restaurant' | 'menu-item';

@Component({
  selector: 'lib-favorite-button',
  standalone: true,
  templateUrl: './favorite-button.component.html',
  styleUrl: './favorite-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteButtonComponent {
  private readonly facade = inject(FavoritesFacade);

  @Input({ required: true }) id!: string;
  @Input({ required: true }) type!: FavoriteTargetType;
  @Input() size: 'sm' | 'md' = 'md';
  @Input() label = 'restaurant';

  protected isFavorited(): boolean {
    return this.type === 'restaurant'
      ? this.facade.isRestaurantFavorited(this.id)
      : this.facade.isMenuItemFavorited(this.id);
  }

  protected async onToggle(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (this.type === 'restaurant') {
      await this.facade.toggleRestaurantFavorite(this.id);
    } else {
      await this.facade.toggleMenuItemFavorite(this.id);
    }
  }
}
