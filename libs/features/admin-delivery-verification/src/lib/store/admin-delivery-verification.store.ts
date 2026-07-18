import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AdminDeliveryPartnerResponseDto,
  AdminAuditLogResponseDto,
  DeliveryComplianceResponseDto,
  DeliveryDocumentResponseDto,
  DeliveryVerificationResponseDto,
  DeliveryBankAccountResponseDto,
  DeliveryOnboardingResponseDto,
  DeliveryOnboardingChangeItemDto,
  NotificationResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { AdminDeliveryVerificationService } from '../services/admin-delivery-verification.service';

const PAGE_SIZE = 20;
const AUDIT_PAGE_SIZE = 10;

export type PartnerStatusFilter = AdminDeliveryPartnerResponseDto['status'];

/** The same notification types the partner-facing delivery-verification store already listens
 *  for (see libs/features/delivery-verification/src/lib/store) — reused here so an admin
 *  reviewing a partner's detail sees the same live signal the partner does. */
const REFRESH_ON_NOTIFICATION_TYPES = new Set([
  'DELIVERY_PARTNER_VERIFICATION_SUBMITTED',
  'DELIVERY_PARTNER_VERIFICATION_APPROVED',
  'DELIVERY_PARTNER_VERIFICATION_REJECTED',
  'DELIVERY_PARTNER_CHANGES_REQUESTED',
]);

@Injectable({ providedIn: 'root' })
export class AdminDeliveryVerificationStore {
  private readonly service = inject(AdminDeliveryVerificationService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);

  private readonly _partners = signal<AdminDeliveryPartnerResponseDto[]>([]);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _total = signal(0);
  private readonly _search = signal('');
  private readonly _statusFilter = signal<PartnerStatusFilter | null>(null);
  private readonly _verifiedFilter = signal<boolean | null>(null);
  private readonly _onlineFilter = signal<boolean | null>(null);
  private readonly _dateFrom = signal('');
  private readonly _dateTo = signal('');
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _selectedPartnerId = signal<string | null>(null);
  private readonly _compliance = signal<DeliveryComplianceResponseDto | null>(null);
  private readonly _documents = signal<DeliveryDocumentResponseDto[]>([]);
  /** Only populated once an admin action returns it — there is no admin-facing GET for these. */
  private readonly _verification = signal<DeliveryVerificationResponseDto | null>(null);
  private readonly _bankAccount = signal<DeliveryBankAccountResponseDto | null>(null);
  private readonly _onboarding = signal<DeliveryOnboardingResponseDto | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  private readonly _auditLogs = signal<AdminAuditLogResponseDto[]>([]);
  private readonly _auditPage = signal(1);
  private readonly _auditTotalPages = signal(1);
  private readonly _auditLoading = signal(false);

  private joinedPartnerRoom: string | null = null;

  readonly partners = this._partners.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly total = this._total.asReadonly();
  readonly search = this._search.asReadonly();
  readonly statusFilter = this._statusFilter.asReadonly();
  readonly verifiedFilter = this._verifiedFilter.asReadonly();
  readonly onlineFilter = this._onlineFilter.asReadonly();
  readonly dateFrom = this._dateFrom.asReadonly();
  readonly dateTo = this._dateTo.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly selectedPartnerId = this._selectedPartnerId.asReadonly();
  readonly compliance = this._compliance.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly verification = this._verification.asReadonly();
  readonly bankAccount = this._bankAccount.asReadonly();
  readonly onboarding = this._onboarding.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly auditLogs = this._auditLogs.asReadonly();
  readonly auditPage = this._auditPage.asReadonly();
  readonly auditTotalPages = this._auditTotalPages.asReadonly();
  readonly auditLoading = this._auditLoading.asReadonly();

  readonly selectedPartner = computed(
    () => this._partners().find((p) => p.id === this._selectedPartnerId()) ?? null,
  );

  /** Falls back to the compliance snapshot's stage until a mutation response supplies the
   *  fuller DeliveryVerificationResponseDto (with rejectedReason/submittedAt/decidedAt). */
  readonly verificationStage = computed(
    () => this._verification()?.stage ?? this._compliance()?.verificationStage ?? null,
  );

  readonly bankVerificationStatus = computed(
    () => this._bankAccount()?.verificationStatus ?? this._compliance()?.bankVerificationStatus ?? null,
  );

  /** Best-effort chronological view derived entirely from data already fetched for this detail
   *  panel — there is no admin-facing verification/onboarding history endpoint to call (see
   *  AdminDeliveryVerificationService's doc comments), so this is not a full audit trail, just
   *  the timestamps we do have. */
  readonly timeline = computed(() => {
    const entries: { label: string; at: string }[] = [];
    const verification = this._verification();
    const onboarding = this._onboarding();
    const bankAccount = this._bankAccount();

    for (const document of this._documents()) {
      entries.push({ label: `Document uploaded: ${document.documentType}`, at: document.createdAt });
      if (document.verifiedAt) {
        entries.push({ label: `Document ${document.status.toLowerCase()}: ${document.documentType}`, at: document.verifiedAt });
      }
    }
    if (bankAccount) {
      entries.push({ label: 'Bank account added', at: bankAccount.createdAt });
      if (bankAccount.verifiedAt) {
        entries.push({ label: `Bank account ${bankAccount.verificationStatus.toLowerCase()}`, at: bankAccount.verifiedAt });
      }
    }
    if (onboarding?.submittedAt) {
      entries.push({ label: 'Onboarding submitted', at: onboarding.submittedAt });
    }
    if (onboarding?.decidedAt) {
      entries.push({ label: `Onboarding ${onboarding.status.toLowerCase()}`, at: onboarding.decidedAt });
    }
    if (verification?.submittedAt) {
      entries.push({ label: 'Verification submitted', at: verification.submittedAt });
    }
    if (verification?.decidedAt) {
      entries.push({ label: `Verification ${verification.stage.toLowerCase()}`, at: verification.decidedAt });
    }

    return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  });

  async loadPartners(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.service.getPartners({
        page: this._page(),
        limit: PAGE_SIZE,
        search: this._search() || undefined,
        status: this._statusFilter() ?? undefined,
        verified: this._verifiedFilter() ?? undefined,
        online: this._onlineFilter() ?? undefined,
        dateFrom: this._dateFrom() || undefined,
        dateTo: this._dateTo() || undefined,
      });

      this._partners.set(response.items);
      this._totalPages.set(response.totalPages);
      this._total.set(response.total);
    } catch {
      this._error.set('Unable to load delivery partners. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(value: string): void {
    this._search.set(value);
    this._page.set(1);
    void this.loadPartners();
  }

  setStatusFilter(value: PartnerStatusFilter | null): void {
    this._statusFilter.set(value);
    this._page.set(1);
    void this.loadPartners();
  }

  setVerifiedFilter(value: boolean | null): void {
    this._verifiedFilter.set(value);
    this._page.set(1);
    void this.loadPartners();
  }

  setOnlineFilter(value: boolean | null): void {
    this._onlineFilter.set(value);
    this._page.set(1);
    void this.loadPartners();
  }

  setDateRange(from: string, to: string): void {
    this._dateFrom.set(from);
    this._dateTo.set(to);
    this._page.set(1);
    void this.loadPartners();
  }

  setPage(page: number): void {
    this._page.set(page);
    void this.loadPartners();
  }

  async selectPartner(partner: AdminDeliveryPartnerResponseDto | null): Promise<void> {
    this._selectedPartnerId.set(partner?.id ?? null);
    this._verification.set(null);
    this._bankAccount.set(null);
    this._onboarding.set(null);
    this._actionError.set(null);

    if (!partner) {
      return;
    }

    this._detailLoading.set(true);

    try {
      const [compliance, documents] = await Promise.all([
        this.service.getCompliance(partner.id).catch(() => null),
        this.service.getDocuments(partner.id).catch(() => []),
      ]);

      this._compliance.set(compliance);
      this._documents.set(documents);
      void this.loadAuditLog(1);
      void this.joinPartnerRoom(partner.user.id);
    } finally {
      this._detailLoading.set(false);
    }
  }

  async loadAuditLog(page: number): Promise<void> {
    const partnerId = this._selectedPartnerId();
    if (!partnerId) {
      return;
    }

    this._auditLoading.set(true);

    try {
      const response = await this.service.getAuditLog(partnerId, page, AUDIT_PAGE_SIZE);
      this._auditLogs.set(response.items);
      this._auditPage.set(response.page);
      this._auditTotalPages.set(response.totalPages);
    } catch {
      this._auditLogs.set([]);
    } finally {
      this._auditLoading.set(false);
    }
  }

  async advanceVerification(): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;
    await this.runVerificationAction(id, () => this.service.advanceVerification(id));
  }

  async rejectVerification(reason: string): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;
    await this.runVerificationAction(id, () => this.service.rejectVerification(id, reason));
  }

  async suspendVerification(): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;
    await this.runVerificationAction(id, () => this.service.suspendVerification(id));
  }

  async reinstateVerification(): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;
    await this.runVerificationAction(id, () => this.service.reinstateVerification(id));
  }

  async verifyDocument(documentId: string): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;
    await this.runDocumentAction(id, documentId, () => this.service.verifyDocument(id, documentId));
  }

  async rejectDocument(documentId: string, reason: string): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;
    await this.runDocumentAction(id, documentId, () => this.service.rejectDocument(id, documentId, reason));
  }

  async verifyBankAccount(): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;

    await this.runAction(id, async () => {
      this._bankAccount.set(await this.service.verifyBankAccount(id));
      await this.refreshCompliance(id);
    });
  }

  async rejectBankAccount(): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;

    await this.runAction(id, async () => {
      this._bankAccount.set(await this.service.rejectBankAccount(id));
      await this.refreshCompliance(id);
    });
  }

  async requestOnboardingChanges(items: DeliveryOnboardingChangeItemDto[]): Promise<void> {
    const id = this._selectedPartnerId();
    if (!id) return;

    await this.runAction(id, async () => {
      this._onboarding.set(await this.service.requestOnboardingChanges(id, items));
    });
  }

  private async refreshCompliance(deliveryPartnerId: string): Promise<void> {
    this._compliance.set(await this.service.getCompliance(deliveryPartnerId).catch(() => this._compliance()));
  }

  private async runVerificationAction(deliveryPartnerId: string, action: () => Promise<DeliveryVerificationResponseDto>): Promise<void> {
    await this.runAction(deliveryPartnerId, async () => {
      this._verification.set(await action());
      await this.refreshCompliance(deliveryPartnerId);
      void this.loadPartners();
    });
  }

  private async runDocumentAction(
    deliveryPartnerId: string,
    documentId: string,
    action: () => Promise<DeliveryDocumentResponseDto>,
  ): Promise<void> {
    this._processingId.set(documentId);
    this._actionError.set(null);

    try {
      const updated = await action();
      this._documents.set(this._documents().map((doc) => (doc.id === documentId ? updated : doc)));
      await this.refreshCompliance(deliveryPartnerId);
    } catch {
      this._actionError.set('That action failed. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private async runAction(processingKey: string, action: () => Promise<void>): Promise<void> {
    this._processingId.set(processingKey);
    this._actionError.set(null);

    try {
      await action();
    } catch {
      this._actionError.set('That action failed. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  /** Joins the selected partner's own `user:<userId>` room — admins are authorized to join any
   *  room (see the backend gateway's isAuthorizedForRoom), so this is real and backend-confirmed,
   *  not a fabricated "verification room". There is no queue-wide admin broadcast room in the
   *  backend today (no `emitToRoom`/`emitToAdmins` call exists for verification submissions), so
   *  the queue itself has no realtime refresh — only the open detail panel does. */
  private async joinPartnerRoom(userId: string): Promise<void> {
    if (this.joinedPartnerRoom === userId) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom(`user:${userId}`);
    if (!joined) {
      return;
    }

    this.joinedPartnerRoom = userId;

    this.realtimeSocketService.on<NotificationResponseDto>('notification', (notification) => {
      if (this._selectedPartnerId() && REFRESH_ON_NOTIFICATION_TYPES.has(notification.type)) {
        const id = this._selectedPartnerId();
        if (id) {
          void this.refreshCompliance(id);
          void this.loadAuditLog(this._auditPage());
        }
      }
    });

    this.realtimeSocketService.on('delivery.onboarding.submitted', () => {
      const id = this._selectedPartnerId();
      if (id) void this.refreshCompliance(id);
    });

    this.realtimeSocketService.on('delivery.onboarding.changes-requested', () => {
      const id = this._selectedPartnerId();
      if (id) void this.refreshCompliance(id);
    });
  }
}
