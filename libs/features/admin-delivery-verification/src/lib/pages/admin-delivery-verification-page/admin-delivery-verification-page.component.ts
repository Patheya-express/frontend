import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminDeliveryPartnerResponseDto, DeliveryDocumentResponseDto } from '@patheya-express-frontend/api-sdk';
import { MediaUrlService } from '@patheya-express-frontend/core';
import {
  ConfirmDialogComponent,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  TableToolbarComponent,
  type DataTableColumn,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { AdminDeliveryVerificationFacade } from '../../facades/admin-delivery-verification.facade';
import type { PartnerStatusFilter } from '../../store/admin-delivery-verification.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'partner', label: 'Partner' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'verified', label: 'Verified' },
  { key: 'status', label: 'Current Status' },
  { key: 'online', label: 'Online' },
  { key: 'created', label: 'Submitted' },
  { key: 'actions', label: 'Actions' },
];

const STATUS_OPTIONS: { value: PartnerStatusFilter; label: string }[] = [
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ON_DELIVERY', label: 'On Delivery' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

interface ChangeSectionOption {
  key: string;
  label: string;
}

const CHANGE_SECTIONS: ChangeSectionOption[] = [
  { key: 'personal', label: 'Personal Details' },
  { key: 'address', label: 'Address' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'documents', label: 'Documents' },
  { key: 'bank', label: 'Bank Account' },
];

type VerificationActionType = 'advance' | 'reject' | 'suspend' | 'reinstate';

/**
 * Admin delivery-verification console — queue + split-view detail, mirroring
 * AdminRestaurantVerificationPageComponent's shape. Every section here is backed by a real,
 * already-generated SDK endpoint; sections the ticket asked for that have no backing endpoint
 * (bulk operations, live fleet, per-vehicle admin metadata, admin profile/address view, an
 * aggregate operations dashboard) were intentionally left out rather than fabricated — see the
 * EDPH-3 completion report for the full list.
 */
@Component({
  selector: 'lib-admin-delivery-verification-page',
  standalone: true,
  imports: [
    FormsModule,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    TableToolbarComponent,
    SearchInputComponent,
    DataTableComponent,
    StatusChipComponent,
    PaginationComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './admin-delivery-verification-page.component.html',
  styleUrl: './admin-delivery-verification-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDeliveryVerificationPageComponent implements OnInit {
  protected readonly facade = inject(AdminDeliveryVerificationFacade);
  private readonly mediaUrl = inject(MediaUrlService);

  protected readonly columns = COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly changeSections = CHANGE_SECTIONS;

  protected rejectReason = '';
  protected changeReasons: Record<string, string> = {};
  protected readonly pendingVerificationAction = signal<VerificationActionType | null>(null);
  protected readonly pendingDocumentRejectId = signal<string | null>(null);
  protected documentRejectReason = '';

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as PartnerStatusFilter | null);
  }

  protected onVerifiedFilterChange(value: string): void {
    this.facade.setVerifiedFilter(value === '' ? null : value === 'true');
  }

  protected onOnlineFilterChange(value: string): void {
    this.facade.setOnlineFilter(value === '' ? null : value === 'true');
  }

  protected onDateFromChange(value: string): void {
    this.facade.setDateRange(value, this.facade.dateTo());
  }

  protected onDateToChange(value: string): void {
    this.facade.setDateRange(this.facade.dateFrom(), value);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected onAuditPageChange(page: number): void {
    void this.facade.loadAuditPage(page);
  }

  protected selectPartner(partner: AdminDeliveryPartnerResponseDto): void {
    this.rejectReason = '';
    this.changeReasons = {};
    void this.facade.selectPartner(partner);
  }

  protected closeDetail(): void {
    void this.facade.selectPartner(null);
  }

  protected partnerName(partner: AdminDeliveryPartnerResponseDto): string {
    return [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ');
  }

  protected vehicleSummary(partner: AdminDeliveryPartnerResponseDto): string {
    return `${partner.vehicleType} • ${partner.vehicleNumber}`;
  }

  protected currentOrderLabel(partner: AdminDeliveryPartnerResponseDto): string {
    return partner.currentOrder ? `${partner.currentOrder.orderNumber} (${partner.currentOrder.status})` : '—';
  }

  protected formattedDate(value: string): string {
    return new Date(value).toLocaleDateString();
  }

  protected formattedDateTime(value: string): string {
    return new Date(value).toLocaleString();
  }

  protected formattedAmount(value: number): string {
    return `₹${Number(value).toFixed(2)}`;
  }

  protected resolveUrl(path: string | undefined): string | undefined {
    return this.mediaUrl.resolve(path);
  }

  protected profilePhoto(): DeliveryDocumentResponseDto | null {
    return (
      this.facade
        .documents()
        .find((doc) => doc.documentType === 'PROFILE_PHOTO' || doc.documentType === 'SELFIE') ?? null
    );
  }

  protected statusTone(status: string): StatusChipTone {
    switch (status) {
      case 'VERIFIED':
      case 'APPROVED':
      case 'COMPLIANT':
      case 'AVAILABLE':
        return 'success';
      case 'REJECTED':
      case 'EXPIRED':
      case 'SUSPENDED':
      case 'NON_COMPLIANT':
        return 'error';
      case 'AT_RISK':
      case 'UNDER_REVIEW':
        return 'info';
      default:
        return 'neutral';
    }
  }

  protected verifiedTone(partner: AdminDeliveryPartnerResponseDto): StatusChipTone {
    return partner.isVerified ? 'success' : 'neutral';
  }

  protected onlineTone(partner: AdminDeliveryPartnerResponseDto): StatusChipTone {
    return partner.online ? 'success' : 'neutral';
  }

  // --- Verification actions ---
  protected requestVerificationAction(type: VerificationActionType): void {
    this.pendingVerificationAction.set(type);
  }

  protected cancelVerificationAction(): void {
    this.pendingVerificationAction.set(null);
  }

  protected async confirmVerificationAction(): Promise<void> {
    const type = this.pendingVerificationAction();
    this.pendingVerificationAction.set(null);
    if (!type) return;

    if (type === 'advance') {
      await this.facade.advanceVerification();
    } else if (type === 'reject') {
      if (!this.rejectReason.trim()) return;
      await this.facade.rejectVerification(this.rejectReason.trim());
      this.rejectReason = '';
    } else if (type === 'suspend') {
      await this.facade.suspendVerification();
    } else {
      await this.facade.reinstateVerification();
    }
  }

  protected verificationActionTitle(): string {
    const titles: Record<VerificationActionType, string> = {
      advance: 'Advance this partner to the next verification stage?',
      reject: 'Reject this verification?',
      suspend: 'Suspend this partner’s verification?',
      reinstate: 'Reinstate this partner’s verification?',
    };
    const type = this.pendingVerificationAction();
    return type ? titles[type] : '';
  }

  protected verificationActionTone(): 'default' | 'danger' {
    const type = this.pendingVerificationAction();
    return type === 'reject' || type === 'suspend' ? 'danger' : 'default';
  }

  // --- Document actions ---
  protected onVerifyDocument(documentId: string): void {
    void this.facade.verifyDocument(documentId);
  }

  protected requestRejectDocument(documentId: string): void {
    this.documentRejectReason = '';
    this.pendingDocumentRejectId.set(documentId);
  }

  protected cancelRejectDocument(): void {
    this.pendingDocumentRejectId.set(null);
    this.documentRejectReason = '';
  }

  protected async confirmRejectDocument(documentId: string): Promise<void> {
    if (!this.documentRejectReason.trim()) return;
    this.pendingDocumentRejectId.set(null);
    await this.facade.rejectDocument(documentId, this.documentRejectReason.trim());
    this.documentRejectReason = '';
  }

  // --- Bank account actions ---
  protected onVerifyBank(): void {
    void this.facade.verifyBankAccount();
  }

  protected onRejectBank(): void {
    void this.facade.rejectBankAccount();
  }

  // --- Onboarding change requests ---
  protected onRequestChanges(): void {
    const items = Object.entries(this.changeReasons)
      .filter(([, reason]) => reason.trim().length > 0)
      .map(([section, reason]) => ({ section, reason: reason.trim() }));

    if (items.length === 0) return;

    void this.facade.requestOnboardingChanges(items).then(() => {
      this.changeReasons = {};
    });
  }

  protected isBusy(): boolean {
    return !!this.facade.processingId();
  }
}
