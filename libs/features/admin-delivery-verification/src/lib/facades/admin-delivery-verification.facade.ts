import { Injectable, inject } from '@angular/core';
import type { AdminDeliveryPartnerResponseDto, DeliveryOnboardingChangeItemDto } from '@patheya-express-frontend/api-sdk';
import { AdminDeliveryVerificationStore, type PartnerStatusFilter } from '../store/admin-delivery-verification.store';

@Injectable({ providedIn: 'root' })
export class AdminDeliveryVerificationFacade {
  private readonly store = inject(AdminDeliveryVerificationStore);

  readonly partners = this.store.partners;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly total = this.store.total;
  readonly search = this.store.search;
  readonly statusFilter = this.store.statusFilter;
  readonly verifiedFilter = this.store.verifiedFilter;
  readonly onlineFilter = this.store.onlineFilter;
  readonly dateFrom = this.store.dateFrom;
  readonly dateTo = this.store.dateTo;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly selectedPartner = this.store.selectedPartner;
  readonly compliance = this.store.compliance;
  readonly documents = this.store.documents;
  readonly verification = this.store.verification;
  readonly bankAccount = this.store.bankAccount;
  readonly onboarding = this.store.onboarding;
  readonly verificationStage = this.store.verificationStage;
  readonly bankVerificationStatus = this.store.bankVerificationStatus;
  readonly timeline = this.store.timeline;
  readonly detailLoading = this.store.detailLoading;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  readonly auditLogs = this.store.auditLogs;
  readonly auditPage = this.store.auditPage;
  readonly auditTotalPages = this.store.auditTotalPages;
  readonly auditLoading = this.store.auditLoading;

  /** Loads the first page. Call once on page init. */
  initialize(): void {
    void this.store.loadPartners();
  }

  refresh(): void {
    void this.store.loadPartners();
  }

  setSearch(value: string): void {
    this.store.setSearch(value);
  }

  setStatusFilter(value: PartnerStatusFilter | null): void {
    this.store.setStatusFilter(value);
  }

  setVerifiedFilter(value: boolean | null): void {
    this.store.setVerifiedFilter(value);
  }

  setOnlineFilter(value: boolean | null): void {
    this.store.setOnlineFilter(value);
  }

  setDateRange(from: string, to: string): void {
    this.store.setDateRange(from, to);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectPartner(partner: AdminDeliveryPartnerResponseDto | null): Promise<void> {
    return this.store.selectPartner(partner);
  }

  loadAuditPage(page: number): Promise<void> {
    return this.store.loadAuditLog(page);
  }

  advanceVerification(): Promise<void> {
    return this.store.advanceVerification();
  }

  rejectVerification(reason: string): Promise<void> {
    return this.store.rejectVerification(reason);
  }

  suspendVerification(): Promise<void> {
    return this.store.suspendVerification();
  }

  reinstateVerification(): Promise<void> {
    return this.store.reinstateVerification();
  }

  verifyDocument(documentId: string): Promise<void> {
    return this.store.verifyDocument(documentId);
  }

  rejectDocument(documentId: string, reason: string): Promise<void> {
    return this.store.rejectDocument(documentId, reason);
  }

  verifyBankAccount(): Promise<void> {
    return this.store.verifyBankAccount();
  }

  rejectBankAccount(): Promise<void> {
    return this.store.rejectBankAccount();
  }

  requestOnboardingChanges(items: DeliveryOnboardingChangeItemDto[]): Promise<void> {
    return this.store.requestOnboardingChanges(items);
  }
}
