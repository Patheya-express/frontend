import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pure layout shell for the row of controls above a data table — search, filters, and
 * actions are all content-projected so this component carries no business logic.
 */
@Component({
  selector: 'lib-table-toolbar',
  standalone: true,
  templateUrl: './table-toolbar.component.html',
  styleUrl: './table-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent {}
