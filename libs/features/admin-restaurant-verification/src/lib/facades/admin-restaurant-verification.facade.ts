import { Injectable, inject } from '@angular/core';
import type { OnboardingChangeItemDto } from '@patheya-express-frontend/api-sdk';
import { AdminRestaurantVerificationStore } from '../store/admin-restaurant-verification.store';

@Injectable({ providedIn: 'root' })
export class AdminRestaurantVerificationFacade {
  private readonly store = inject(AdminRestaurantVerificationStore);

  readonly restaurants = this.store.restaurants;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly total = this.store.total;
  readonly search = this.store.search;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly selectedRestaurant = this.store.selectedRestaurant;
  readonly verification = this.store.verification;
  readonly documents = this.store.documents;
  readonly taxProfile = this.store.taxProfile;
  readonly bankAccount = this.store.bankAccount;
  readonly branches = this.store.branches;
  readonly staff = this.store.staff;
  readonly media = this.store.media;
  readonly compliance = this.store.compliance;
  readonly settings = this.store.settings;
  readonly onboarding = this.store.onboarding;
  readonly healthOverview = this.store.healthOverview;
  readonly detailLoading = this.store.detailLoading;
  readonly processingId = this.store.processingId;
  readonly actionError = this.store.actionError;

  /** Loads the first page. Call once on page init. */
  initialize(): void {
    void this.store.loadRestaurants();
  }

  refresh(): void {
    void this.store.loadRestaurants();
  }

  setSearch(value: string): void {
    this.store.setSearch(value);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectRestaurant(restaurantId: string): Promise<void> {
    return this.store.selectRestaurant(restaurantId);
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

  verifyGst(): Promise<void> {
    return this.store.verifyGst();
  }

  rejectGst(): Promise<void> {
    return this.store.rejectGst();
  }

  verifyFssai(): Promise<void> {
    return this.store.verifyFssai();
  }

  rejectFssai(): Promise<void> {
    return this.store.rejectFssai();
  }

  verifyBankAccount(): Promise<void> {
    return this.store.verifyBankAccount();
  }

  rejectBankAccount(): Promise<void> {
    return this.store.rejectBankAccount();
  }

  requestOnboardingChanges(items: OnboardingChangeItemDto[]): Promise<void> {
    return this.store.requestOnboardingChanges(items);
  }
}
