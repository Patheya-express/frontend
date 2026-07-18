import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MediaUrlService } from '@patheya-express-frontend/core';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { AdminRestaurantVerificationFacade } from '../../facades/admin-restaurant-verification.facade';

interface ChangeSectionOption {
  key: string;
  label: string;
}

const CHANGE_SECTIONS: ChangeSectionOption[] = [
  { key: 'business', label: 'Business Details' },
  { key: 'restaurant', label: 'Restaurant Details' },
  { key: 'location', label: 'Location' },
  { key: 'branch', label: 'Branch Details' },
  { key: 'hours', label: 'Operating Hours' },
  { key: 'bank', label: 'Bank Details' },
  { key: 'gst', label: 'GST' },
  { key: 'fssai', label: 'FSSAI' },
  { key: 'pan', label: 'PAN' },
  { key: 'media', label: 'Restaurant Media' },
  { key: 'documents', label: 'Compliance Documents' },
];

@Component({
  selector: 'lib-admin-restaurant-verification-page',
  standalone: true,
  imports: [
    FormsModule,
    EmptyStateComponent,
    ErrorStateComponent,
    PaginationComponent,
    SearchInputComponent,
    SkeletonComponent,
    StatusChipComponent,
  ],
  templateUrl: './admin-restaurant-verification-page.component.html',
  styleUrl: './admin-restaurant-verification-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRestaurantVerificationPageComponent implements OnInit {
  protected readonly facade = inject(AdminRestaurantVerificationFacade);
  private readonly mediaUrl = inject(MediaUrlService);

  protected rejectReason = '';
  protected readonly changeSections = CHANGE_SECTIONS;
  protected changeReasons: Record<string, string> = {};

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected onSearchChange(value: string): void {
    this.facade.setSearch(value);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected onSelect(restaurantId: string): void {
    void this.facade.selectRestaurant(restaurantId);
  }

  protected onAdvance(): void {
    void this.facade.advanceVerification();
  }

  protected onReject(): void {
    if (!this.rejectReason.trim()) return;
    void this.facade.rejectVerification(this.rejectReason).then(() => (this.rejectReason = ''));
  }

  protected onSuspend(): void {
    void this.facade.suspendVerification();
  }

  protected onReinstate(): void {
    void this.facade.reinstateVerification();
  }

  protected onVerifyDocument(documentId: string): void {
    void this.facade.verifyDocument(documentId);
  }

  protected onRejectDocument(documentId: string): void {
    void this.facade.rejectDocument(documentId, 'Document does not meet requirements');
  }

  protected onVerifyGst(): void {
    void this.facade.verifyGst();
  }

  protected onRejectGst(): void {
    void this.facade.rejectGst();
  }

  protected onVerifyFssai(): void {
    void this.facade.verifyFssai();
  }

  protected onRejectFssai(): void {
    void this.facade.rejectFssai();
  }

  protected onVerifyBank(): void {
    void this.facade.verifyBankAccount();
  }

  protected onRejectBank(): void {
    void this.facade.rejectBankAccount();
  }

  protected onRequestChanges(): void {
    const items = Object.entries(this.changeReasons)
      .filter(([, reason]) => reason.trim().length > 0)
      .map(([section, reason]) => ({ section, reason: reason.trim() }));

    if (items.length === 0) {
      return;
    }

    void this.facade.requestOnboardingChanges(items).then(() => {
      this.changeReasons = {};
    });
  }

  protected resolveUrl(path: string | undefined): string | undefined {
    return this.mediaUrl.resolve(path);
  }

  protected statusTone(status: string): StatusChipTone {
    switch (status) {
      case 'VERIFIED':
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'EXPIRED':
      case 'SUSPENDED':
        return 'error';
      default:
        return 'info';
    }
  }
}
