import { Injectable, inject } from '@angular/core';
import type { InviteStaffDto, UpdateStaffDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantStaffStore, type StaffFilter } from '../store/restaurant-staff.store';

@Injectable({ providedIn: 'root' })
export class RestaurantStaffFacade {
  private readonly store = inject(RestaurantStaffStore);

  readonly staff = this.store.pagedStaff;
  readonly search = this.store.search;
  readonly filter = this.store.filter;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly pendingCount = this.store.pendingCount;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly actionError = this.store.actionError;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.load();
  }

  setSearch(term: string): void {
    this.store.setSearch(term);
  }

  setFilter(filter: StaffFilter): void {
    this.store.setFilter(filter);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  inviteStaff(dto: InviteStaffDto): Promise<boolean> {
    return this.store.inviteStaff(dto);
  }

  updateStaff(staffId: string, dto: UpdateStaffDto): Promise<boolean> {
    return this.store.updateStaff(staffId, dto);
  }

  revokeStaff(staffId: string): Promise<boolean> {
    return this.store.revokeStaff(staffId);
  }
}
