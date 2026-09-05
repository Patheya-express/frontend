import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  PartnerShellComponent,
  StatusChipComponent,
  NotificationBadgeComponent,
  type PartnerNavLink,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import {
  RealtimeSocketService,
  CurrentDeliveryPartnerService,
  CurrentDeliveryVerificationService,
  MobilePlatformService,
  PushNotificationsService,
  resolvePushTapRoute,
} from '@patheya-express-frontend/core';
import {
  NotificationsService,
  type DeliveryPartnerResponseDto,
  type DeliveryVerificationResponseDto,
} from '@patheya-express-frontend/api-sdk';

const BASE_NAV_LINKS: PartnerNavLink[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Assignments', path: '/assignments' },
  { label: 'Fees', path: '/fees' },
];

const APPROVED_ONLY_NAV_LINKS: PartnerNavLink[] = [
  { label: 'Profile', path: '/profile' },
  { label: 'Vehicles', path: '/profile/vehicles' },
  { label: 'Documents', path: '/profile/documents' },
  { label: 'Bank', path: '/profile/bank' },
  { label: 'Compliance', path: '/profile/compliance' },
];

const VERIFICATION_NAV_LINK: PartnerNavLink = {
  label: 'Verification',
  path: '/verification',
};

function stageTone(
  stage: DeliveryVerificationResponseDto['stage'] | undefined,
): StatusChipTone {
  switch (stage) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
    case 'SUSPENDED':
      return 'error';
    case undefined:
    case 'DRAFT':
      return 'neutral';
    default:
      return 'info';
  }
}

/**
 * Reads verification stage and current-vehicle info via shared/core's always-eager cached
 * services (CurrentDeliveryPartnerService/CurrentDeliveryVerificationService) rather than the
 * delivery-verification/delivery-vehicles feature libs directly — those are lazy-loaded via
 * their own routes, and this root App component is part of the eager initial bundle, so
 * @nx/enforce-module-boundaries forbids statically importing them here.
 */
@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    RouterOutlet,
    PartnerShellComponent,
    StatusChipComponent,
    NotificationBadgeComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly currentDeliveryPartnerService = inject(
    CurrentDeliveryPartnerService,
  );
  private readonly currentDeliveryVerificationService = inject(
    CurrentDeliveryVerificationService,
  );
  private readonly mobilePlatformService = inject(MobilePlatformService);
  private readonly pushNotificationsService = inject(PushNotificationsService);
  private readonly notificationsService = inject(NotificationsService);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly isNative = this.mobilePlatformService.isNative();
  protected readonly brandName = 'Patheya Express Courier';
  protected readonly stageTone = stageTone;

  private readonly _partner = signal<DeliveryPartnerResponseDto | null>(null);
  private readonly _verification =
    signal<DeliveryVerificationResponseDto | null>(null);
  private readonly _unreadNotifications = signal(0);

  protected readonly verification = this._verification.asReadonly();
  protected readonly unreadNotifications =
    this._unreadNotifications.asReadonly();

  protected readonly isApproved = computed(
    () => this._verification()?.stage === 'APPROVED',
  );

  /**
   * Online Protection UI: nav items requiring approval (Profile/Vehicles/Documents/Bank/
   * Compliance) are hidden entirely — not just disabled — until verification is APPROVED,
   * matching "Hide Go Online ... Do NOT allow Assignments/Dashboard online toggle." The backend
   * already rejects the underlying requests regardless; this is purely UX.
   */
  protected readonly navLinks = computed<PartnerNavLink[]>(() => {
    const links = [...BASE_NAV_LINKS, VERIFICATION_NAV_LINK];
    if (this.isApproved()) {
      links.push(...APPROVED_ONLY_NAV_LINKS);
    }
    return links;
  });

  protected readonly currentVehicleLabel = computed(() => {
    const partner = this._partner();
    return partner ? `${partner.vehicleType} · ${partner.vehicleNumber}` : null;
  });

  protected readonly avatarInitials = computed(() => {
    const user = this.authFacade.user();
    if (!user) {
      return '';
    }
    return `${user.firstName.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase();
  });

  constructor() {
    if (this.isAuthenticated()) {
      void this.loadHeaderData();
    }

    this.realtimeSocketService.on('notification', () => {
      this._unreadNotifications.update((count) => count + 1);
      // Any notification could be a verification-status change — cheap to just refresh.
      this.currentDeliveryVerificationService.invalidate();
      void this.loadHeaderData();
    });

    // Push notifications: request permission + register once signed in on native; a signed-out
    // guest is never prompted. Independent of the realtime socket above — push is for when the app
    // is backgrounded/killed and the socket isn't connected, not a replacement for it.
    effect(() => {
      if (this.isNative && this.isAuthenticated()) {
        void this.pushNotificationsService.initialize();
      }
    });

    // Sends the device token to the backend as soon as registration completes, and again if it
    // ever changes.
    effect(() => {
      const token = this.pushNotificationsService.token();
      const platform = this.mobilePlatformService.platform();

      if (!token || platform === 'web' || !this.isAuthenticated()) {
        return;
      }

      void this.notificationsService.notificationsControllerRegisterPushToken({
        body: { platform, token },
      });
    });

    // Delivery-app has no per-assignment push payload contract yet — a tap always wakes the app to
    // the Assignments screen, which is the same authoritative REST-backed list this store already
    // polls/refreshes. Push here is purely "wake and look" — it never carries assignment state
    // itself (that stays in DeliveryAssignmentsStore via REST/Socket.IO, per M6's transport split).
    effect(() => {
      const tapped = this.pushNotificationsService.tapped();
      if (!tapped) {
        return;
      }

      this.pushNotificationsService.acknowledgeTap();

      const routerPath = resolvePushTapRoute(tapped.data, {
        rootSegment: 'assignments',
      });
      if (routerPath) {
        void this.router.navigateByUrl(routerPath);
      }
    });
  }

  private async loadHeaderData(): Promise<void> {
    try {
      const [partner, verification] = await Promise.all([
        this.currentDeliveryPartnerService.getPartner(),
        this.currentDeliveryVerificationService.getVerification(),
      ]);
      this._partner.set(partner);
      this._verification.set(verification);
    } catch {
      // A delivery partner who hasn't onboarded yet has no profile/verification row — the
      // header simply shows no vehicle/verification chip until onboarding creates one.
    }
  }

  protected async onLogout(): Promise<void> {
    await this.authFacade.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}
