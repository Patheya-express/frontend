import { Injectable, inject } from '@angular/core';
import type { AdminDeliveryPartnerResponseDto } from '@patheya-express-frontend/api-sdk';
import { AdminDeliveryStore, type PartnerStatusFilter } from '../store/admin-delivery.store';

@Injectable({ providedIn: 'root' })
export class AdminDeliveryFacade {
  private readonly store = inject(AdminDeliveryStore);

  readonly state = this.store.state;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Loads the first page of delivery partners. Call once on page init. */
  initialize(): Promise<void> {
    return this.store.loadPartners();
  }

  refresh(): Promise<void> {
    return this.store.loadPartners();
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setStatusFilter(status: PartnerStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setAvailabilityFilter(availability: boolean | null): void {
    this.store.setAvailabilityFilter(availability);
  }

  setVerifiedFilter(verified: boolean | null): void {
    this.store.setVerifiedFilter(verified);
  }

  setOnlineFilter(online: boolean | null): void {
    this.store.setOnlineFilter(online);
  }

  setDateRange(dateFrom: string, dateTo: string): void {
    this.store.setDateRange(dateFrom, dateTo);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectPartner(partner: AdminDeliveryPartnerResponseDto | null): void {
    this.store.selectPartner(partner);
  }

  approvePartner(partnerId: string): Promise<void> {
    return this.store.approvePartner(partnerId);
  }

  rejectPartner(partnerId: string): Promise<void> {
    return this.store.rejectPartner(partnerId);
  }

  suspendPartner(partnerId: string): Promise<void> {
    return this.store.suspendPartner(partnerId);
  }

  restorePartner(partnerId: string): Promise<void> {
    return this.store.restorePartner(partnerId);
  }

  forceOffline(partnerId: string): Promise<void> {
    return this.store.forceOffline(partnerId);
  }

  blockPartner(partnerId: string): Promise<void> {
    return this.store.blockPartner(partnerId);
  }

  unblockPartner(partnerId: string): Promise<void> {
    return this.store.unblockPartner(partnerId);
  }

  reassignCurrentOrder(partnerId: string, deliveryPartnerUserId: string): Promise<void> {
    return this.store.reassignCurrentOrder(partnerId, deliveryPartnerUserId);
  }

  dismissActionError(): void {
    this.store.dismissActionError();
  }
}
