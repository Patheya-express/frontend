import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  RestaurantResponseDto,
  VerificationResponseDto,
  DocumentResponseDto,
  TaxProfileResponseDto,
  BankAccountResponseDto,
  BranchResponseDto,
  StaffResponseDto,
  MediaResponseDto,
  ComplianceResponseDto,
  RestaurantSettingsResponseDto,
  OnboardingResponseDto,
  OnboardingChangeItemDto,
} from '@patheya-express-frontend/api-sdk';
import { AdminRestaurantVerificationService } from '../services/admin-restaurant-verification.service';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class AdminRestaurantVerificationStore {
  private readonly service = inject(AdminRestaurantVerificationService);

  private readonly _restaurants = signal<RestaurantResponseDto[]>([]);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _total = signal(0);
  private readonly _search = signal('');
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _selectedRestaurantId = signal<string | null>(null);
  private readonly _verification = signal<VerificationResponseDto | null>(null);
  private readonly _documents = signal<DocumentResponseDto[]>([]);
  private readonly _taxProfile = signal<TaxProfileResponseDto | null>(null);
  private readonly _bankAccount = signal<BankAccountResponseDto | null>(null);
  private readonly _branches = signal<BranchResponseDto[]>([]);
  private readonly _staff = signal<StaffResponseDto[]>([]);
  private readonly _media = signal<MediaResponseDto[]>([]);
  private readonly _compliance = signal<ComplianceResponseDto | null>(null);
  private readonly _settings = signal<RestaurantSettingsResponseDto | null>(null);
  private readonly _onboarding = signal<OnboardingResponseDto | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _processingId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);

  readonly restaurants = this._restaurants.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly total = this._total.asReadonly();
  readonly search = this._search.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly selectedRestaurantId = this._selectedRestaurantId.asReadonly();
  readonly verification = this._verification.asReadonly();
  readonly documents = this._documents.asReadonly();
  readonly taxProfile = this._taxProfile.asReadonly();
  readonly bankAccount = this._bankAccount.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly staff = this._staff.asReadonly();
  readonly media = this._media.asReadonly();
  readonly compliance = this._compliance.asReadonly();
  readonly settings = this._settings.asReadonly();
  readonly onboarding = this._onboarding.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();

  /** Simple restaurant health rollup for the admin review screen — derived from data already
   *  fetched for this detail view, not a separate backend call. */
  readonly healthOverview = computed(() => {
    const compliance = this._compliance();
    const branches = this._branches();
    const staff = this._staff();

    return {
      branchCount: branches.length,
      activeBranchCount: branches.filter((b) => b.isActive).length,
      activeStaffCount: staff.filter((s) => s.status === 'ACTIVE').length,
      pendingStaffCount: staff.filter((s) => s.status === 'INVITED').length,
      complianceStatus: compliance?.overallStatus ?? null,
      documentsExpiringSoon: compliance?.expiringWithin30Days.length ?? 0,
    };
  });
  readonly processingId = this._processingId.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly selectedRestaurant = computed(
    () => this._restaurants().find((r) => r.id === this._selectedRestaurantId()) ?? null,
  );

  async loadRestaurants(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.service.getRestaurants({
        page: this._page(),
        limit: PAGE_SIZE,
        search: this._search() || undefined,
      });

      this._restaurants.set(response.items);
      this._totalPages.set(response.totalPages);
      this._total.set(response.total);
    } catch {
      this._error.set('Unable to load restaurants. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(value: string): void {
    this._search.set(value);
    this._page.set(1);
    void this.loadRestaurants();
  }

  setPage(page: number): void {
    this._page.set(page);
    void this.loadRestaurants();
  }

  async selectRestaurant(restaurantId: string): Promise<void> {
    this._selectedRestaurantId.set(restaurantId);
    this._detailLoading.set(true);
    this._actionError.set(null);

    try {
      const [verification, documents, taxProfile, bankAccount, branches, staff, media, compliance, settings, onboarding] =
        await Promise.all([
          this.service.getVerification(restaurantId),
          this.service.getDocuments(restaurantId),
          this.service.getTaxProfile(restaurantId).catch(() => null),
          this.service.getBankAccount(restaurantId).catch(() => null),
          this.service.getBranches(restaurantId).catch(() => []),
          this.service.getStaff(restaurantId).catch(() => []),
          this.service.getMedia(restaurantId).catch(() => []),
          this.service.getCompliance(restaurantId).catch(() => null),
          this.service.getSettings(restaurantId).catch(() => null),
          this.service.getOnboarding(restaurantId).catch(() => null),
        ]);

      this._verification.set(verification);
      this._documents.set(documents);
      this._taxProfile.set(taxProfile);
      this._bankAccount.set(bankAccount);
      this._branches.set(branches);
      this._staff.set(staff);
      this._media.set(media);
      this._compliance.set(compliance);
      this._settings.set(settings);
      this._onboarding.set(onboarding);
    } catch {
      this._actionError.set('Unable to load verification detail for this restaurant.');
    } finally {
      this._detailLoading.set(false);
    }
  }

  private currentRestaurantId(): string | null {
    return this._selectedRestaurantId();
  }

  async advanceVerification(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.advanceVerification(id), this._verification);
  }

  async rejectVerification(reason: string): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.rejectVerification(id, reason), this._verification);
  }

  async suspendVerification(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.suspendVerification(id), this._verification);
  }

  async reinstateVerification(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.reinstateVerification(id), this._verification);
  }

  async verifyDocument(documentId: string): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;

    await this.runListAction(id, documentId, () => this.service.verifyDocument(id, documentId));
  }

  async rejectDocument(documentId: string, reason: string): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;

    await this.runListAction(id, documentId, () =>
      this.service.rejectDocument(id, documentId, reason),
    );
  }

  async verifyGst(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.verifyGst(id), this._taxProfile);
  }

  async rejectGst(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.rejectGst(id), this._taxProfile);
  }

  async verifyFssai(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.verifyFssai(id), this._taxProfile);
  }

  async rejectFssai(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.rejectFssai(id), this._taxProfile);
  }

  async verifyBankAccount(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.verifyBankAccount(id), this._bankAccount);
  }

  async rejectBankAccount(): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.rejectBankAccount(id), this._bankAccount);
  }

  async requestOnboardingChanges(items: OnboardingChangeItemDto[]): Promise<void> {
    const id = this.currentRestaurantId();
    if (!id) return;
    await this.runAction(id, () => this.service.requestOnboardingChanges(id, items), this._onboarding);
  }

  private async runAction<T>(
    processingKey: string,
    action: () => Promise<T>,
    target: { set: (value: T) => void },
  ): Promise<void> {
    this._processingId.set(processingKey);
    this._actionError.set(null);

    try {
      const result = await action();
      target.set(result);
    } catch {
      this._actionError.set('That action failed. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }

  private async runListAction(
    restaurantId: string,
    documentId: string,
    action: () => Promise<DocumentResponseDto>,
  ): Promise<void> {
    this._processingId.set(documentId);
    this._actionError.set(null);

    try {
      const updated = await action();
      this._documents.set(this._documents().map((doc) => (doc.id === documentId ? updated : doc)));
    } catch {
      this._actionError.set('That action failed. Please try again.');
    } finally {
      this._processingId.set(null);
    }
  }
}
