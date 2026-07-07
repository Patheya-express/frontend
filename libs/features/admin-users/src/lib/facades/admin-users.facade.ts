import { Injectable, inject } from '@angular/core';
import type { UserResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminUsersStore, type UserRoleFilter, type UserStatusFilter } from '../store/admin-users.store';

@Injectable({ providedIn: 'root' })
export class AdminUsersFacade {
  private readonly store = inject(AdminUsersStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Loads the first page of users. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadUsers();
  }

  refresh(): Promise<void> {
    return this.store.loadUsers();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setRoleFilter(role: UserRoleFilter | null): void {
    this.store.setRoleFilter(role);
  }

  setStatusFilter(status: UserStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectUser(user: UserResponseDto | null): void {
    this.store.selectUser(user);
  }

  activateUser(userId: string): Promise<void> {
    return this.store.activateUser(userId);
  }

  suspendUser(userId: string): Promise<void> {
    return this.store.suspendUser(userId);
  }

  restoreUser(userId: string): Promise<void> {
    return this.store.restoreUser(userId);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
