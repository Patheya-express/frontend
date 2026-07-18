import { Injectable, inject } from '@angular/core';
import type {
  CreateBranchDto,
  UpdateBranchDto,
  UpsertOperatingHourDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantBranchesStore } from '../store/restaurant-branches.store';

@Injectable({ providedIn: 'root' })
export class RestaurantBranchesFacade {
  private readonly store = inject(RestaurantBranchesStore);

  readonly branches = this.store.pagedBranches;
  readonly totalBranches = this.store.branches;
  readonly search = this.store.search;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly actionError = this.store.actionError;

  readonly operatingHours = this.store.operatingHours;
  readonly hoursLoading = this.store.hoursLoading;
  readonly hoursSaving = this.store.hoursSaving;
  readonly hoursError = this.store.hoursError;
  readonly hoursSavedAt = this.store.hoursSavedAt;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.load();
  }

  setSearch(term: string): void {
    this.store.setSearch(term);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  getBranch(branchId: string) {
    return this.store.getBranch(branchId);
  }

  createBranch(dto: CreateBranchDto): Promise<boolean> {
    return this.store.createBranch(dto);
  }

  updateBranch(branchId: string, dto: UpdateBranchDto): Promise<boolean> {
    return this.store.updateBranch(branchId, dto);
  }

  removeBranch(branchId: string): Promise<boolean> {
    return this.store.removeBranch(branchId);
  }

  loadOperatingHours(branchId: string): Promise<void> {
    return this.store.loadOperatingHours(branchId);
  }

  saveOperatingHours(branchId: string, hours: UpsertOperatingHourDto[]): Promise<boolean> {
    return this.store.saveOperatingHours(branchId, hours);
  }
}
