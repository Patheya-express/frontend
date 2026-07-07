import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { RestaurantResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  TableToolbarComponent,
  type DataTableColumn,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { AdminRestaurantsFacade } from '../../facades/admin-restaurants.facade';
import type { RestaurantStatusFilter } from '../../store/admin-restaurants.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'name', label: 'Restaurant Name' },
  { key: 'owner', label: 'Owner' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'cuisine', label: 'Cuisine' },
  { key: 'status', label: 'Status' },
  { key: 'active', label: 'Active' },
  { key: 'createdAt', label: 'Created' },
  { key: 'actions', label: 'Actions' },
];

const STATUS_OPTIONS: { value: RestaurantStatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const STATUS_TONES: Record<RestaurantResponseDto['status'], StatusChipTone> = {
  PENDING: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  SUSPENDED: 'error',
};

type PendingActionType = 'approve' | 'reject' | 'suspend' | 'restore';

interface PendingAction {
  type: PendingActionType;
  restaurant: RestaurantResponseDto;
}

@Component({
  selector: 'lib-admin-restaurants-page',
  standalone: true,
  imports: [
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    TableToolbarComponent,
    SearchInputComponent,
    DataTableComponent,
    StatusChipComponent,
    PaginationComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './admin-restaurants-page.component.html',
  styleUrl: './admin-restaurants-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRestaurantsPageComponent implements OnInit {
  private readonly facade = inject(AdminRestaurantsFacade);

  protected readonly columns = COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly processingId = this.facade.processingId;
  protected readonly actionError = this.facade.actionError;

  protected readonly pendingAction = signal<PendingAction | null>(null);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onCityFilter(value: string): void {
    this.facade.setCityFilter(value);
  }

  protected onCuisineFilter(value: string): void {
    this.facade.setCuisineFilter(value);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as RestaurantStatusFilter | null);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected viewRestaurant(restaurant: RestaurantResponseDto): void {
    this.facade.selectRestaurant(restaurant);
  }

  protected closeDetails(): void {
    this.facade.selectRestaurant(null);
  }

  protected requestAction(type: PendingActionType, restaurant: RestaurantResponseDto): void {
    this.pendingAction.set({ type, restaurant });
  }

  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  protected async confirmAction(): Promise<void> {
    const pending = this.pendingAction();
    if (!pending) {
      return;
    }

    this.pendingAction.set(null);

    if (pending.type === 'approve') {
      await this.facade.approveRestaurant(pending.restaurant.id);
    } else if (pending.type === 'reject') {
      await this.facade.rejectRestaurant(pending.restaurant.id);
    } else if (pending.type === 'suspend') {
      await this.facade.suspendRestaurant(pending.restaurant.id);
    } else {
      await this.facade.restoreRestaurant(pending.restaurant.id);
    }
  }

  protected isProcessing(restaurantId: string): boolean {
    return this.processingId() === restaurantId;
  }

  protected ownerName(restaurant: RestaurantResponseDto): string {
    if (!restaurant.owner) {
      return '—';
    }
    return [restaurant.owner.firstName, restaurant.owner.lastName].filter(Boolean).join(' ');
  }

  protected ownerEmail(restaurant: RestaurantResponseDto): string {
    return restaurant.owner?.email ?? '—';
  }

  protected ownerPhone(restaurant: RestaurantResponseDto): string {
    return restaurant.owner?.phone ?? '—';
  }

  protected city(restaurant: RestaurantResponseDto): string {
    return restaurant.branches?.[0]?.city ?? '—';
  }

  protected cuisineNames(restaurant: RestaurantResponseDto): string {
    const names = restaurant.cuisines?.map((cuisine) => cuisine.name) ?? [];
    return names.length > 0 ? names.join(', ') : '—';
  }

  protected statusLabel(restaurant: RestaurantResponseDto): string {
    return STATUS_OPTIONS.find((option) => option.value === restaurant.status)?.label ?? restaurant.status;
  }

  protected statusTone(restaurant: RestaurantResponseDto): StatusChipTone {
    return STATUS_TONES[restaurant.status];
  }

  protected activeLabel(restaurant: RestaurantResponseDto): string {
    return restaurant.isActive ? 'Active' : 'Inactive';
  }

  protected activeTone(restaurant: RestaurantResponseDto): StatusChipTone {
    return restaurant.isActive ? 'success' : 'neutral';
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected dialogTitle(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    if (pending.type === 'approve') {
      return 'Approve this restaurant?';
    }

    if (pending.type === 'reject') {
      return 'Reject this restaurant?';
    }

    if (pending.type === 'suspend') {
      return 'Suspend this restaurant?';
    }

    return 'Restore this restaurant?';
  }

  protected dialogMessage(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    const name = pending.restaurant.name;

    if (pending.type === 'approve') {
      return `${name} will become visible to customers.`;
    }

    if (pending.type === 'reject') {
      return `${name}'s application will be rejected.`;
    }

    if (pending.type === 'suspend') {
      return `${name} will be hidden from customers until restored.`;
    }

    return `${name} will be restored to approved.`;
  }

  protected dialogConfirmLabel(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return 'Confirm';
    }

    if (pending.type === 'approve') {
      return 'Approve';
    }

    if (pending.type === 'reject') {
      return 'Reject';
    }

    if (pending.type === 'suspend') {
      return 'Suspend';
    }

    return 'Restore';
  }

  protected dialogTone(): 'default' | 'danger' {
    const type = this.pendingAction()?.type;
    return type === 'reject' || type === 'suspend' ? 'danger' : 'default';
  }

  protected isPendingBusy(): boolean {
    const pending = this.pendingAction();
    return !!pending && this.isProcessing(pending.restaurant.id);
  }
}
