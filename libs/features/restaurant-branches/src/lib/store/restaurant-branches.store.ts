import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  BranchResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
  OperatingHourResponseDto,
  UpsertOperatingHourDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantBranchesFeatureService } from '../services/restaurant-branches.service';

const PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class RestaurantBranchesStore {
  private readonly service = inject(RestaurantBranchesFeatureService);

  private readonly _branches = signal<BranchResponseDto[]>([]);
  private readonly _search = signal('');
  private readonly _page = signal(1);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _actionError = signal<string | null>(null);

  private readonly _operatingHours = signal<OperatingHourResponseDto[]>([]);
  private readonly _hoursLoading = signal(false);
  private readonly _hoursSaving = signal(false);
  private readonly _hoursError = signal<string | null>(null);
  private readonly _hoursSavedAt = signal<Date | null>(null);

  readonly branches = this._branches.asReadonly();
  readonly search = this._search.asReadonly();
  readonly page = this._page.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly operatingHours = this._operatingHours.asReadonly();
  readonly hoursLoading = this._hoursLoading.asReadonly();
  readonly hoursSaving = this._hoursSaving.asReadonly();
  readonly hoursError = this._hoursError.asReadonly();
  readonly hoursSavedAt = this._hoursSavedAt.asReadonly();

  readonly filteredBranches = computed(() => {
    const term = this._search().trim().toLowerCase();
    const branches = this._branches();

    if (!term) {
      return branches;
    }

    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(term) || branch.city.toLowerCase().includes(term),
    );
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredBranches().length / PAGE_SIZE)),
  );

  readonly pagedBranches = computed(() => {
    const start = (this._page() - 1) * PAGE_SIZE;
    return this.filteredBranches().slice(start, start + PAGE_SIZE);
  });

  setSearch(term: string): void {
    this._search.set(term);
    this._page.set(1);
  }

  setPage(page: number): void {
    this._page.set(page);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const branches = await this.service.getBranches();
      this._branches.set(branches);
    } catch {
      this._error.set('Unable to load branches. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  getBranch(branchId: string): BranchResponseDto | undefined {
    return this._branches().find((branch) => branch.id === branchId);
  }

  async createBranch(dto: CreateBranchDto): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      const branch = await this.service.createBranch(dto);
      this._branches.set([...this._branches(), branch]);
      return true;
    } catch {
      this._actionError.set('Unable to add the branch. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async updateBranch(branchId: string, dto: UpdateBranchDto): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      const updated = await this.service.updateBranch(branchId, dto);
      this._branches.set(this._branches().map((b) => (b.id === branchId ? updated : b)));
      return true;
    } catch {
      this._actionError.set('Unable to update the branch. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async removeBranch(branchId: string): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      await this.service.removeBranch(branchId);
      this._branches.set(this._branches().filter((b) => b.id !== branchId));
      return true;
    } catch {
      this._actionError.set(
        'Unable to remove the branch — set another branch as primary first if this one is primary.',
      );
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async loadOperatingHours(branchId: string): Promise<void> {
    this._hoursLoading.set(true);
    this._hoursError.set(null);

    try {
      const hours = await this.service.getOperatingHours(branchId);
      this._operatingHours.set(hours);
    } catch {
      this._hoursError.set('Unable to load operating hours. Please try again.');
    } finally {
      this._hoursLoading.set(false);
    }
  }

  async saveOperatingHours(branchId: string, hours: UpsertOperatingHourDto[]): Promise<boolean> {
    this._hoursSaving.set(true);
    this._hoursError.set(null);

    try {
      const saved = await this.service.replaceOperatingHours(branchId, hours);
      this._operatingHours.set(saved);
      this._hoursSavedAt.set(new Date());
      return true;
    } catch {
      this._hoursError.set('Unable to save operating hours. Please try again.');
      return false;
    } finally {
      this._hoursSaving.set(false);
    }
  }
}
