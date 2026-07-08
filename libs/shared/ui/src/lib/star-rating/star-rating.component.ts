import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-star-rating',
  standalone: true,
  templateUrl: './star-rating.component.html',
  styleUrl: './star-rating.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRatingComponent {
  /** Current rating, 0–5. Fractional values (e.g. 4.3) render a partially-styled star in read-only mode. */
  @Input() rating = 0;
  /** Interactive mode — renders as a set of buttons and emits ratingChange on click. */
  @Input() editable = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Output() ratingChange = new EventEmitter<number>();

  protected readonly stars = [1, 2, 3, 4, 5];

  protected fillPercent(star: number): number {
    const diff = this.rating - (star - 1);
    return Math.max(0, Math.min(1, diff)) * 100;
  }

  protected select(star: number): void {
    if (this.editable) {
      this.ratingChange.emit(star);
    }
  }
}
