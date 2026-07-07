import { Injectable, computed, inject, signal } from '@angular/core';
import type { UserResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminUsersService } from '../services/admin-users.service';

export type UserRoleFilter = UserResponseDto['role'];
export type UserStatusFilter = UserResponseDto['status'];

export interface AdminUsersFilters {
  search: string;
  role: UserRoleFilter | null;
  status: UserStatusFilter | null;
}

export interface AdminUsersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersState {
  users: UserResponseDto[];
  pagination: AdminUsersPagination;
  filters: AdminUsersFilters;
  selectedUser: UserResponseDto | null;
}

const DEFAULT_PAGINATION: AdminUsersPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminUsersFilters = { search: '', role: null, status: null };

@Injectable({ providedIn: 'root' })
export class AdminUsersStore {
  private readonly adminUsersService = inject(AdminUsersService);

  private readonly _users = signal<UserResponseDto[]>([]);
  private readonly _pagination = signal<AdminUsersPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminUsersFilters>(DEFAULT_FILTERS);
  private readonly _selectedUser = signal<UserResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly state = computed<AdminUsersState>(() => ({
    users: this._users(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedUser: this._selectedUser(),
  }));

  async loadUsers(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminUsersService.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        role: filters.role ?? undefined,
        status: filters.status ?? undefined,
      });

      this._users.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load users. Please try again.');
      this._users.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadUsers();
  }

  setRoleFilter(role: UserRoleFilter | null): void {
    this._filters.update((filters) => ({ ...filters, role }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadUsers();
  }

  setStatusFilter(status: UserStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadUsers();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadUsers();
  }

  selectUser(user: UserResponseDto | null): void {
    this._selectedUser.set(user);
  }

  activateUser(userId: string): Promise<void> {
    return this.transitionUser(
      userId,
      (user) => ({ ...user, status: 'ACTIVE' }),
      (original) => this.adminUsersService.activateUser(original.id),
    );
  }

  suspendUser(userId: string): Promise<void> {
    return this.transitionUser(
      userId,
      (user) => ({ ...user, status: 'SUSPENDED' }),
      (original) => this.adminUsersService.suspendUser(original.id),
    );
  }

  restoreUser(userId: string): Promise<void> {
    return this.transitionUser(
      userId,
      (user) => ({ ...user, status: 'ACTIVE' }),
      (original) => this.adminUsersService.restoreUser(original.id),
    );
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * The single path every user status transition runs through — activate, suspend, and
   * restore — mirroring DeliveryAssignmentsStore's transitionAssignment: optimistically apply
   * the change, then reconcile with the server response, or roll back to the original on
   * failure. `processingId`/`actionError` are shared across all three transitions on purpose —
   * only one transition can be in flight for a given user at a time.
   */
  private async transitionUser(
    userId: string,
    applyOptimistic: (user: UserResponseDto) => UserResponseDto,
    action: (original: UserResponseDto) => Promise<UserResponseDto>,
  ): Promise<void> {
    const original = this._users().find((user) => user.id === userId);
    if (!original) {
      return;
    }

    this._processingId.set(userId);
    this.replaceUser(userId, applyOptimistic(original));

    try {
      const updated = await action(original);
      this.replaceUser(userId, updated);

      if (this._selectedUser()?.id === userId) {
        this._selectedUser.set(updated);
      }

      this._actionError.set(null);
    } catch {
      this.replaceUser(userId, original);
      this._actionError.set('Unable to update this user. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private replaceUser(userId: string, replacement: UserResponseDto): void {
    this._users.update((users) => users.map((user) => (user.id === userId ? replacement : user)));
  }
}
