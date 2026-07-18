import { Injectable, computed, inject, signal } from '@angular/core';
import type { InviteStaffDto, StaffResponseDto, UpdateStaffDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantStaffFeatureService } from '../services/restaurant-staff.service';

export type StaffFilter = 'ALL' | 'ACTIVE' | 'INVITED' | 'REVOKED';

const PAGE_SIZE = 10;

@Injectable({ providedIn: 'root' })
export class RestaurantStaffStore {
  private readonly service = inject(RestaurantStaffFeatureService);

  private readonly _staff = signal<StaffResponseDto[]>([]);
  private readonly _search = signal('');
  private readonly _filter = signal<StaffFilter>('ALL');
  private readonly _page = signal(1);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _actionError = signal<string | null>(null);

  readonly search = this._search.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly page = this._page.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly filteredStaff = computed(() => {
    const term = this._search().trim().toLowerCase();
    const filter = this._filter();

    return this._staff().filter((member) => {
      const matchesFilter = filter === 'ALL' || member.status === filter;
      const name = `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.toLowerCase();
      const matchesSearch =
        !term || name.includes(term) || (member.user?.email ?? '').toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredStaff().length / PAGE_SIZE)),
  );

  readonly pagedStaff = computed(() => {
    const start = (this._page() - 1) * PAGE_SIZE;
    return this.filteredStaff().slice(start, start + PAGE_SIZE);
  });

  readonly pendingCount = computed(
    () => this._staff().filter((member) => member.status === 'INVITED').length,
  );

  setSearch(term: string): void {
    this._search.set(term);
    this._page.set(1);
  }

  setFilter(filter: StaffFilter): void {
    this._filter.set(filter);
    this._page.set(1);
  }

  setPage(page: number): void {
    this._page.set(page);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const staff = await this.service.getStaff();
      this._staff.set(staff);
    } catch {
      this._error.set('Unable to load staff. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async inviteStaff(dto: InviteStaffDto): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      const member = await this.service.inviteStaff(dto);
      this._staff.set([member, ...this._staff()]);
      return true;
    } catch {
      this._actionError.set(
        'Unable to invite this staff member. Make sure the email belongs to a registered Patheya Express account.',
      );
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      const updated = await this.service.updateStaff(staffId, dto);
      this._staff.set(this._staff().map((member) => (member.id === staffId ? updated : member)));
      return true;
    } catch {
      this._actionError.set('Unable to update this staff member. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async revokeStaff(staffId: string): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      await this.service.revokeStaff(staffId);
      this._staff.set(
        this._staff().map((member) =>
          member.id === staffId ? { ...member, status: 'REVOKED' as const } : member,
        ),
      );
      return true;
    } catch {
      this._actionError.set('Unable to remove this staff member. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
