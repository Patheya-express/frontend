import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type {
  DeliveryComplianceResponseDto,
  DeliveryOnboardingResponseDto,
  DeliveryVerificationResponseDto,
  NotificationResponseDto,
  VerificationHistoryEntryDto,
} from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { DeliveryVerificationFeatureService } from '../services/delivery-verification.service';

const REFRESH_ON_NOTIFICATION_TYPES = new Set([
  'DELIVERY_PARTNER_VERIFICATION_SUBMITTED',
  'DELIVERY_PARTNER_VERIFICATION_APPROVED',
  'DELIVERY_PARTNER_VERIFICATION_REJECTED',
  'DELIVERY_PARTNER_CHANGES_REQUESTED',
]);

@Injectable({ providedIn: 'root' })
export class DeliveryVerificationStore {
  private readonly service = inject(DeliveryVerificationFeatureService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly authFacade = inject(AuthFacade);

  private joinedUserRoom = false;

  private readonly _verification = signal<DeliveryVerificationResponseDto | null>(null);
  private readonly _history = signal<VerificationHistoryEntryDto[]>([]);
  private readonly _onboarding = signal<DeliveryOnboardingResponseDto | null>(null);
  private readonly _compliance = signal<DeliveryComplianceResponseDto | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly verification = this._verification.asReadonly();
  readonly history = this._history.asReadonly();
  readonly onboarding = this._onboarding.asReadonly();
  readonly compliance = this._compliance.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isApproved = computed(() => this._verification()?.stage === 'APPROVED');
  readonly isRejected = computed(() => this._verification()?.stage === 'REJECTED');
  readonly isSuspended = computed(() => this._verification()?.stage === 'SUSPENDED');

  private loadPromise: Promise<void> | null = null;

  constructor() {
    // Joins the authenticated user's own realtime room once per session so this store's data
    // (and the standing /verification page) stays live without polling — mirrors
    // CustomerNotificationsStore's connectRealtime() pattern.
    effect(() => {
      if (this.authFacade.isAuthenticated()) {
        void this.connectRealtime();
      }
    });
  }

  private async connectRealtime(): Promise<void> {
    if (this.joinedUserRoom) {
      return;
    }

    const userId = this.authFacade.user()?.id;
    if (!userId) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom(`user:${userId}`);
    if (!joined || this.joinedUserRoom) {
      return;
    }

    this.joinedUserRoom = true;

    this.realtimeSocketService.on<NotificationResponseDto>('notification', (notification) => {
      if (REFRESH_ON_NOTIFICATION_TYPES.has(notification.type)) {
        void this.refresh();
      }
    });

    this.realtimeSocketService.on('delivery.onboarding.submitted', () => void this.refresh());
    this.realtimeSocketService.on('delivery.onboarding.changes-requested', () => void this.refresh());
  }

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetch();
    }
    return this.loadPromise;
  }

  refresh(): Promise<void> {
    this.loadPromise = this.fetch();
    return this.loadPromise;
  }

  private async fetch(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const [verification, history, onboarding, compliance] = await Promise.all([
        this.service.getStatus(),
        this.service.getHistory(),
        this.service.getOnboardingState(),
        this.service.getComplianceSnapshot(),
      ]);
      this._verification.set(verification);
      this._history.set(history);
      this._onboarding.set(onboarding);
      this._compliance.set(compliance);
    } catch {
      this._error.set('Unable to load your verification status. Please refresh and try again.');
    } finally {
      this._loading.set(false);
    }
  }
}
