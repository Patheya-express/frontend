import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-pagination',
  standalone: true,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  @Input({ required: true }) page!: number;
  @Input({ required: true }) totalPages!: number;
  @Input() total?: number;
  @Output() pageChange = new EventEmitter<number>();

  protected get canGoPrevious(): boolean {
    return this.page > 1;
  }

  protected get canGoNext(): boolean {
    return this.page < this.totalPages;
  }

  protected previous(): void {
    if (this.canGoPrevious) {
      this.pageChange.emit(this.page - 1);
    }
  }

  protected next(): void {
    if (this.canGoNext) {
      this.pageChange.emit(this.page + 1);
    }
  }
}
