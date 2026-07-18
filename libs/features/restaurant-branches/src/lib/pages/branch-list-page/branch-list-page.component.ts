import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  type DataTableColumn,
} from '@patheya-express-frontend/ui';
import { RestaurantBranchesFacade } from '../../facades/restaurant-branches.facade';

const COLUMNS: DataTableColumn[] = [
  { key: 'name', label: 'Branch' },
  { key: 'city', label: 'City' },
  { key: 'primary', label: 'Primary' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
];

@Component({
  selector: 'lib-branch-list-page',
  standalone: true,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    SearchInputComponent,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  templateUrl: './branch-list-page.component.html',
  styleUrl: './branch-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchListPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantBranchesFacade);
  protected readonly columns = COLUMNS;

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected onSearch(term: string): void {
    this.facade.setSearch(term);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
