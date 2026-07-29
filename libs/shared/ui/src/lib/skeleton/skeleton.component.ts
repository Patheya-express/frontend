import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type SkeletonVariant = 'card-grid' | 'block';
export type SkeletonBlockShape = 'text' | 'circle' | 'rect';

@Component({
  selector: 'lib-skeleton',
  standalone: true,
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  @Input() count = 1;
  /** `'card-grid'` (default) renders the original fixed image+title+subtitle+meta card shape —
   *  every existing usage keeps that exact look. `'block'` renders `count` single shape
   *  primitives instead (`shape`/`width`/`height`), for composing an arbitrary placeholder
   *  layout (an avatar circle, a line of text, …) rather than a card grid. */
  @Input() variant: SkeletonVariant = 'card-grid';
  @Input() shape: SkeletonBlockShape = 'rect';
  @Input() width = '100%';
  @Input() height: string | null = null;

  protected get blocks(): number[] {
    return Array.from({ length: this.count }, (_, index) => index);
  }
}
