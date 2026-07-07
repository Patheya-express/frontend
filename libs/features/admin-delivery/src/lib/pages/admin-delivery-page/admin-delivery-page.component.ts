import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { AdminDeliveryPartnerResponseDto } from '@patheya-express-frontend/api-sdk';
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
import { AdminDeliveryFacade } from '../../facades/admin-delivery.facade';
import type { PartnerStatusFilter } from '../../store/admin-delivery.store';

const COLUMNS: DataTableColumn[] = [
  { key: 'partner', label: 'Partner' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'license', label: 'License' },
  { key: 'verified', label: 'Verified' },
  { key: 'status', label: 'Status' },
  { key: 'online', label: 'Online' },
  { key: 'availability', label: 'Availability' },
  { key: 'currentOrder', label: 'Current Order' },
  { key: 'completedDeliveries', label: 'Completed Deliveries' },
  { key: 'todaysDeliveries', label: "Today's Deliveries" },
  { key: 'estimatedFeesToday', label: 'Estimated Fees Today' },
  { key: 'createdAt', label: 'Created' },
  { key: 'actions', label: 'Actions' },
];

const STATUS_OPTIONS: { value: PartnerStatusFilter; label: string }[] = [
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ON_DELIVERY', label: 'On Delivery' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const STATUS_TONES: Record<AdminDeliveryPartnerResponseDto['status'], StatusChipTone> = {
  OFFLINE: 'neutral',
  AVAILABLE: 'success',
  ON_DELIVERY: 'info',
  SUSPENDED: 'error',
};

type PendingActionType = 'approve' | 'reject' | 'suspend' | 'restore' | 'force-offline' | 'block' | 'unblock';

interface PendingAction {
  type: PendingActionType;
  partner: AdminDeliveryPartnerResponseDto;
}

@Component({
  selector: 'lib-admin-delivery-page',
  standalone: true,
  imports: [
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
  templateUrl: './admin-delivery-page.component.html',
  styleUrl: './admin-delivery-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDeliveryPageComponent implements OnInit {
  private readonly facade = inject(AdminDeliveryFacade);

  protected readonly columns = COLUMNS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly state = this.facade.state;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly processingId = this.facade.processingId;
  protected readonly actionError = this.facade.actionError;

  protected readonly pendingAction = signal<PendingAction | null>(null);
  protected readonly reassigningPartnerId = signal<string | null>(null);
  protected readonly reassignInputValue = signal('');

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected retry(): void {
    void this.facade.refresh();
  }

  protected onSearch(value: string): void {
    this.facade.setSearch(value);
  }

  protected onStatusFilterChange(value: string): void {
    this.facade.setStatusFilter((value || null) as PartnerStatusFilter | null);
  }

  protected onAvailabilityFilterChange(value: string): void {
    this.facade.setAvailabilityFilter(value === '' ? null : value === 'true');
  }

  protected onVerifiedFilterChange(value: string): void {
    this.facade.setVerifiedFilter(value === '' ? null : value === 'true');
  }

  protected onOnlineFilterChange(value: string): void {
    this.facade.setOnlineFilter(value === '' ? null : value === 'true');
  }

  protected onDateFromChange(value: string): void {
    this.facade.setDateRange(value, this.state().filters.dateTo);
  }

  protected onDateToChange(value: string): void {
    this.facade.setDateRange(this.state().filters.dateFrom, value);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected viewPartner(partner: AdminDeliveryPartnerResponseDto): void {
    this.facade.selectPartner(partner);
  }

  protected closeDetails(): void {
    this.facade.selectPartner(null);
  }

  protected canApprove(partner: AdminDeliveryPartnerResponseDto): boolean {
    return !partner.isVerified;
  }

  protected canReject(partner: AdminDeliveryPartnerResponseDto): boolean {
    return partner.isVerified;
  }

  protected canSuspend(partner: AdminDeliveryPartnerResponseDto): boolean {
    return partner.status !== 'SUSPENDED';
  }

  protected canRestore(partner: AdminDeliveryPartnerResponseDto): boolean {
    return partner.status === 'SUSPENDED';
  }

  protected canForceOffline(partner: AdminDeliveryPartnerResponseDto): boolean {
    return partner.status === 'AVAILABLE' || partner.status === 'ON_DELIVERY';
  }

  protected canBlock(partner: AdminDeliveryPartnerResponseDto): boolean {
    return partner.user.status !== 'BLOCKED';
  }

  protected canUnblock(partner: AdminDeliveryPartnerResponseDto): boolean {
    return partner.user.status === 'BLOCKED';
  }

  protected requestAction(type: PendingActionType, partner: AdminDeliveryPartnerResponseDto): void {
    this.pendingAction.set({ type, partner });
  }

  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  protected async confirmAction(): Promise<void> {
    const pending = this.pendingAction();
    if (!pending) {
      return;
    }

    this.pendingAction.set(null);
    const id = pending.partner.id;

    if (pending.type === 'approve') {
      await this.facade.approvePartner(id);
    } else if (pending.type === 'reject') {
      await this.facade.rejectPartner(id);
    } else if (pending.type === 'suspend') {
      await this.facade.suspendPartner(id);
    } else if (pending.type === 'restore') {
      await this.facade.restorePartner(id);
    } else if (pending.type === 'force-offline') {
      await this.facade.forceOffline(id);
    } else if (pending.type === 'block') {
      await this.facade.blockPartner(id);
    } else {
      await this.facade.unblockPartner(id);
    }
  }

  protected startReassign(partner: AdminDeliveryPartnerResponseDto): void {
    this.reassigningPartnerId.set(partner.id);
    this.reassignInputValue.set('');
  }

  protected cancelReassign(): void {
    this.reassigningPartnerId.set(null);
    this.reassignInputValue.set('');
  }

  protected onReassignInputChange(value: string): void {
    this.reassignInputValue.set(value);
  }

  protected async confirmReassign(partnerId: string): Promise<void> {
    const targetUserId = this.reassignInputValue().trim();
    if (!targetUserId) {
      return;
    }

    this.reassigningPartnerId.set(null);
    this.reassignInputValue.set('');
    await this.facade.reassignCurrentOrder(partnerId, targetUserId);
  }

  protected isProcessing(partnerId: string): boolean {
    return this.processingId() === partnerId;
  }

  protected partnerName(partner: AdminDeliveryPartnerResponseDto): string {
    return [partner.user.firstName, partner.user.lastName].filter(Boolean).join(' ');
  }

  protected vehicleSummary(partner: AdminDeliveryPartnerResponseDto): string {
    return `${partner.vehicleType} • ${partner.vehicleNumber}`;
  }

  protected statusLabel(partner: AdminDeliveryPartnerResponseDto): string {
    return STATUS_OPTIONS.find((option) => option.value === partner.status)?.label ?? partner.status;
  }

  protected statusTone(partner: AdminDeliveryPartnerResponseDto): StatusChipTone {
    return STATUS_TONES[partner.status];
  }

  protected verifiedLabel(partner: AdminDeliveryPartnerResponseDto): string {
    return partner.isVerified ? 'Verified' : 'Unverified';
  }

  protected verifiedTone(partner: AdminDeliveryPartnerResponseDto): StatusChipTone {
    return partner.isVerified ? 'success' : 'neutral';
  }

  protected onlineLabel(partner: AdminDeliveryPartnerResponseDto): string {
    return partner.online ? 'Online' : 'Offline';
  }

  protected onlineTone(partner: AdminDeliveryPartnerResponseDto): StatusChipTone {
    return partner.online ? 'success' : 'neutral';
  }

  protected availabilityLabel(partner: AdminDeliveryPartnerResponseDto): string {
    if (partner.status === 'AVAILABLE') {
      return 'Available';
    }
    if (partner.status === 'ON_DELIVERY') {
      return 'Busy';
    }
    return 'Unavailable';
  }

  protected availabilityTone(partner: AdminDeliveryPartnerResponseDto): StatusChipTone {
    if (partner.status === 'AVAILABLE') {
      return 'success';
    }
    if (partner.status === 'ON_DELIVERY') {
      return 'info';
    }
    return 'neutral';
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

  protected dialogTitle(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    const titles: Record<PendingActionType, string> = {
      approve: 'Approve this delivery partner?',
      reject: 'Reject this delivery partner?',
      suspend: 'Suspend this delivery partner?',
      restore: 'Restore this delivery partner?',
      'force-offline': 'Force this delivery partner offline?',
      block: 'Block this delivery partner?',
      unblock: 'Unblock this delivery partner?',
    };

    return titles[pending.type];
  }

  protected dialogMessage(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    const name = this.partnerName(pending.partner);
    const messages: Record<PendingActionType, string> = {
      approve: `${name} will be marked verified and eligible for assignments.`,
      reject: `${name} will be marked unverified.`,
      suspend: `${name} will be unable to go available or receive assignments until restored.`,
      restore: `${name} will be restored to offline and can go available again.`,
      'force-offline': `${name} will be immediately set offline.`,
      block: `${name}'s account will be blocked — they will be unable to log in at all.`,
      unblock: `${name}'s account will be restored to active.`,
    };

    return messages[pending.type];
  }

  protected dialogConfirmLabel(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return 'Confirm';
    }

    const labels: Record<PendingActionType, string> = {
      approve: 'Approve',
      reject: 'Reject',
      suspend: 'Suspend',
      restore: 'Restore',
      'force-offline': 'Force Offline',
      block: 'Block',
      unblock: 'Unblock',
    };

    return labels[pending.type];
  }

  protected dialogTone(): 'default' | 'danger' {
    const type = this.pendingAction()?.type;
    return type === 'reject' || type === 'suspend' || type === 'force-offline' || type === 'block' ? 'danger' : 'default';
  }

  protected isPendingBusy(): boolean {
    const pending = this.pendingAction();
    return !!pending && this.isProcessing(pending.partner.id);
  }
}
