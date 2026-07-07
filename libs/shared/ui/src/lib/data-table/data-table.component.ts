import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export interface DataTableColumn {
  key: string;
  label: string;
}

/**
 * Deliberately lightweight: renders the header from `columns` and lets the caller project
 * `<tr>` rows directly as plain HTML. No cell templates or sorting abstraction — those add
 * real complexity and no current admin list needs them yet.
 */
@Component({
  selector: 'lib-data-table',
  standalone: true,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  @Input({ required: true }) columns!: DataTableColumn[];
}
