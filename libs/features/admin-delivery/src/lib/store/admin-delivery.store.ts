import { Injectable, computed, inject, signal } from '@angular/core';
import type { AdminDeliveryPartnerResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminDeliveryService } from '../services/admin-delivery.service';

export type PartnerStatusFilter = AdminDeliveryPartnerResponseDto['status'];

export interface AdminDeliveryFilters {
  search: string;
  status: PartnerStatusFilter | null;
  availability: boolean | null;
  verified: boolean | null;
  online: boolean | null;
  dateFrom: string;
  dateTo: string;
}

export interface AdminDeliveryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminDeliveryState {
  partners: AdminDeliveryPartnerResponseDto[];
  pagination: AdminDeliveryPagination;
  filters: AdminDeliveryFilters;
  selectedPartner: AdminDeliveryPartnerResponseDto | null;
}

const DEFAULT_PAGINATION: AdminDeliveryPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminDeliveryFilters = {
  search: '',
  status: null,
  availability: null,
  verified: null,
  online: null,
  dateFrom: '',
  dateTo: '',
};

@Injectable({ providedIn: 'root' })
export class AdminDeliveryStore {
  private readonly adminDeliveryService = inject(AdminDeliveryService);

  private readonly _partners = signal<AdminDeliveryPartnerResponseDto[]>([]);
  private readonly _pagination = signal<AdminDeliveryPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminDeliveryFilters>(DEFAULT_FILTERS);
  private readonly _selectedPartner = signal<AdminDeliveryPartnerResponseDto | null>(null);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly state = computed<AdminDeliveryState>(() => ({
    partners: this._partners(),
    pagination: this._pagination(),
    filters: this._filters(),
    selectedPartner: this._selectedPartner(),
  }));

  async loadPartners(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const filters = this._filters();
      const pagination = this._pagination();

      const response = await this.adminDeliveryService.getPartners({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        status: filters.status ?? undefined,
        availability: filters.availability ?? undefined,
        verified: filters.verified ?? undefined,
        online: filters.online ?? undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      this._partners.set(response.items);
      this._pagination.set({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch {
      this._error.set('Unable to load delivery partners. Please try again.');
      this._partners.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPartners();
  }

  setStatusFilter(status: PartnerStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPartners();
  }

  setAvailabilityFilter(availability: boolean | null): void {
    this._filters.update((filters) => ({ ...filters, availability }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPartners();
  }

  setVerifiedFilter(verified: boolean | null): void {
    this._filters.update((filters) => ({ ...filters, verified }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPartners();
  }

  setOnlineFilter(online: boolean | null): void {
    this._filters.update((filters) => ({ ...filters, online }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPartners();
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this._filters.update((filters) => ({ ...filters, dateFrom, dateTo }));
    this._pagination.update((pagination) => ({ ...pagination, page: 1 }));
    void this.loadPartners();
  }

  setPage(page: number): void {
    this._pagination.update((pagination) => ({ ...pagination, page }));
    void this.loadPartners();
  }

  selectPartner(partner: AdminDeliveryPartnerResponseDto | null): void {
    this._selectedPartner.set(partner);
  }

  approvePartner(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, isVerified: true }),
      async (original) => {
        const updated = await this.adminDeliveryService.approvePartner(original.id);
        return { isVerified: updated.isVerified, status: updated.status };
      },
    );
  }

  rejectPartner(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, isVerified: false }),
      async (original) => {
        const updated = await this.adminDeliveryService.rejectPartner(original.id);
        return { isVerified: updated.isVerified, status: updated.status };
      },
    );
  }

  suspendPartner(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, status: 'SUSPENDED' }),
      async (original) => {
        const updated = await this.adminDeliveryService.suspendPartner(original.id);
        return { status: updated.status };
      },
    );
  }

  restorePartner(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, status: 'OFFLINE' }),
      async (original) => {
        const updated = await this.adminDeliveryService.restorePartner(original.id);
        return { status: updated.status };
      },
    );
  }

  /** `online` isn't part of the force-offline response (it's a DeliveryPartnerResponseDto, no presence field) — assumed false optimistically, confirmed only on next full reload. */
  forceOffline(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, status: 'OFFLINE', online: false }),
      async (original) => {
        const updated = await this.adminDeliveryService.forceOffline(original.id);
        return { status: updated.status };
      },
    );
  }

  /** Block/unblock affect the underlying user's account status, which the row's own Block/Unblock button visibility (canBlock/canUnblock) depends on — must be reconciled onto `user.status` or the button never flips. */
  blockPartner(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, user: { ...partner.user, status: 'BLOCKED' } }),
      async (original) => {
        const updated = await this.adminDeliveryService.blockPartner(original.id);
        return { user: { ...original.user, status: updated.status } };
      },
    );
  }

  unblockPartner(partnerId: string): Promise<void> {
    return this.transitionPartner(
      partnerId,
      (partner) => ({ ...partner, user: { ...partner.user, status: 'ACTIVE' } }),
      async (original) => {
        const updated = await this.adminDeliveryService.unblockPartner(original.id);
        return { user: { ...original.user, status: updated.status } };
      },
    );
  }

  dismissActionError(): void {
    this._actionError.set(null);
  }

  /**
   * The single path every delivery partner action runs through — approve, reject, suspend,
   * restore, force-offline, block, unblock, and reassign — mirroring transitionUser()/
   * transitionRestaurant()/transitionOrder(): optimistically apply the change, then reconcile
   * with whatever fields the action call reports back, or roll back to the original on
   * failure. Each call site decides which partial fields to reconcile since the underlying
   * action responses have different shapes (DeliveryPartnerResponseDto vs UserResponseDto vs
   * nothing meaningful for block/unblock).
   */
  private async transitionPartner(
    partnerId: string,
    applyOptimistic: (partner: AdminDeliveryPartnerResponseDto) => AdminDeliveryPartnerResponseDto,
    action: (original: AdminDeliveryPartnerResponseDto) => Promise<Partial<AdminDeliveryPartnerResponseDto>>,
  ): Promise<void> {
    const original = this._partners().find((partner) => partner.id === partnerId);
    if (!original) {
      return;
    }

    this._processingId.set(partnerId);
    this.replacePartner(partnerId, applyOptimistic(original));

    try {
      const changes = await action(original);
      const reconciled = { ...applyOptimistic(original), ...changes };

      this.replacePartner(partnerId, reconciled);

      if (this._selectedPartner()?.id === partnerId) {
        this._selectedPartner.set(reconciled);
      }

      this._actionError.set(null);
    } catch {
      this.replacePartner(partnerId, original);
      this._actionError.set('Unable to update this delivery partner. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private replacePartner(partnerId: string, replacement: AdminDeliveryPartnerResponseDto): void {
    this._partners.update((partners) => partners.map((partner) => (partner.id === partnerId ? replacement : partner)));
  }
}
