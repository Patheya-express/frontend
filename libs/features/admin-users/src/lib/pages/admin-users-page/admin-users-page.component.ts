import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { UserResponseDto } from '@patheya-express-frontend/api-sdk';
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
import { AdminUsersFacade } from '../../facades/admin-users.facade';
import type { UserRoleFilter, UserStatusFilter } from '../../store/admin-users.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
  { key: 'actions', label: 'Actions' },
];

const ROLE_OPTIONS: { value: UserRoleFilter; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'RESTAURANT_OWNER', label: 'Restaurant Owner' },
  { value: 'RESTAURANT_MANAGER', label: 'Restaurant Manager' },
  { value: 'DELIVERY_PARTNER', label: 'Delivery Partner' },
  { value: 'SUPPORT_AGENT', label: 'Support Agent' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'DISPATCH_MANAGER', label: 'Dispatch Manager' },
];

const STATUS_OPTIONS: { value: UserStatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BLOCKED', label: 'Blocked' },
];

const STATUS_TONES: Record<UserResponseDto['status'], StatusChipTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'error',
  BLOCKED: 'error',
};

const ROLE_LABELS: Record<UserResponseDto['role'], string> = {
  CUSTOMER: 'Customer',
  RESTAURANT_OWNER: 'Restaurant Owner',
  RESTAURANT_MANAGER: 'Restaurant Manager',
  DELIVERY_PARTNER: 'Delivery Partner',
  SUPPORT_AGENT: 'Support Agent',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  DISPATCH_MANAGER: 'Dispatch Manager',
};

type PendingActionType = 'activate' | 'suspend' | 'restore';

interface PendingAction {
  type: PendingActionType;
  user: UserResponseDto;
}

@Component({
  selector: 'lib-admin-users-page',
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
  templateUrl: './admin-users-page.component.html',
  styleUrl: './admin-users-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPageComponent implements OnInit {
  private readonly facade = inject(AdminUsersFacade);

  protected readonly columns = COLUMNS;
  protected readonly roleOptions = ROLE_OPTIONS;
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

  protected onRoleFilterChange(value: string): void {
    this.facade.setRoleFilter((value || null) as UserRoleFilter | null);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as UserStatusFilter | null);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected viewUser(user: UserResponseDto): void {
    this.facade.selectUser(user);
  }

  protected closeDetails(): void {
    this.facade.selectUser(null);
  }

  protected requestAction(type: PendingActionType, user: UserResponseDto): void {
    this.pendingAction.set({ type, user });
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

    if (pending.type === 'activate') {
      await this.facade.activateUser(pending.user.id);
    } else if (pending.type === 'suspend') {
      await this.facade.suspendUser(pending.user.id);
    } else {
      await this.facade.restoreUser(pending.user.id);
    }
  }

  protected isProcessing(userId: string): boolean {
    return this.processingId() === userId;
  }

  protected fullName(user: UserResponseDto): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  protected roleLabel(user: UserResponseDto): string {
    return ROLE_LABELS[user.role];
  }

  protected statusLabel(user: UserResponseDto): string {
    return STATUS_OPTIONS.find((option) => option.value === user.status)?.label ?? user.status;
  }

  protected statusTone(user: UserResponseDto): StatusChipTone {
    return STATUS_TONES[user.status];
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected dialogTitle(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    if (pending.type === 'activate') {
      return 'Activate this user?';
    }

    if (pending.type === 'suspend') {
      return 'Suspend this user?';
    }

    return 'Restore this user?';
  }

  protected dialogMessage(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    const name = this.fullName(pending.user);

    if (pending.type === 'activate') {
      return `${name} will regain access to their account.`;
    }

    if (pending.type === 'suspend') {
      return `${name} will lose access to their account until restored.`;
    }

    return `${name}'s account will be restored to active.`;
  }

  protected dialogConfirmLabel(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return 'Confirm';
    }

    if (pending.type === 'activate') {
      return 'Activate';
    }

    if (pending.type === 'suspend') {
      return 'Suspend';
    }

    return 'Restore';
  }

  protected dialogTone(): 'default' | 'danger' {
    return this.pendingAction()?.type === 'suspend' ? 'danger' : 'default';
  }

  protected isPendingBusy(): boolean {
    const pending = this.pendingAction();
    return !!pending && this.isProcessing(pending.user.id);
  }
}
