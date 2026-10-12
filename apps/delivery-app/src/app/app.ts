import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  PartnerShellComponent,
  StatusChipComponent,
  NotificationBadgeComponent,
  ToastHostComponent,
  ToastService,
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
import { DELIVERY_PARTNER_BRAND_NAME } from './brand';

/** Payload of the server's `delivery.assignment` event (DispatchService.assignOrder /
 *  AdminDispatchService) — ids only, never customer details. */
interface DeliveryAssignmentEvent {
  assignmentId: string;
  orderId: string;
}

/** How many recently-alerted assignment ids to remember for de-duplication. */
const ALERTED_ASSIGNMENT_MEMORY = 50;

/** Must match the backend's DeliveryAssignmentPushListener androidChannelId. Importance 5 =
 *  heads-up banner, appropriate for an offer that expires within seconds. */
const ASSIGNMENT_PUSH_CHANNEL = {
  id: 'delivery_assignments',
  name: 'Delivery assignments',
  description: 'New delivery offers that need your response',
  importance: 5,
} as const;

/** Reads the ids from a push's data payload (delivery-assignment pushes only). */
function assignmentFromPushData(data: unknown): DeliveryAssignmentEvent | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (
    record['type'] !== 'delivery.assignment' ||
    typeof record['assignmentId'] !== 'string' ||
    typeof record['orderId'] !== 'string'
  ) {
    return null;
  }
  return { assignmentId: record['assignmentId'], orderId: record['orderId'] };
}

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
    ToastHostComponent,
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
  private readonly toastService = inject(ToastService);

  /** Assignment ids already alerted this session — a redelivered/duplicate socket event for the
   *  same offer must not raise a second alert. */
  private readonly alertedAssignmentIds: string[] = [];
  private realtimeListenersRegistered = false;

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly isNative = this.mobilePlatformService.isNative();
  protected readonly brandName = DELIVERY_PARTNER_BRAND_NAME;
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
    // Everything realtime/header-related keys off the signed-in user, not off construction time:
    // the app root is created once, before login, and survives logout → login.
    effect(() => {
      const userId = this.authFacade.user()?.id;
      if (!this.isAuthenticated() || !userId) {
        this._partner.set(null);
        this._verification.set(null);
        this._unreadNotifications.set(0);
        return;
      }

      untracked(() => {
        this.registerRealtimeListeners();
        // The server delivers `delivery.assignment` and `notification` only to the user:<id> room,
        // and never joins it automatically. Previously only the lazily-loaded Verification page
        // joined it, so a partner on Dashboard/Assignments got no realtime offers at all.
        // RealtimeSocketService replays the join after reconnects and token rotation.
        void this.realtimeSocketService.joinRoom(`user:${userId}`);
        void this.loadHeaderData();
      });
    });

    // An expired/revoked refresh token clears the session inside AuthStore; without this the
    // partner kept looking at a protected page that could no longer load anything. Never fires on
    // a deliberate logout (see AuthStore.sessionExpired).
    effect(() => {
      if (this.authFacade.sessionExpired()) {
        const redirectTo = this.router.url;
        this.authFacade.acknowledgeSessionExpiry();
        this.toastService.showSnackbar({
          message: 'Your session has expired. Please log in again.',
          tone: 'warning',
        });
        void this.router.navigate(['/auth/login'], {
          queryParams: { redirectTo },
        });
      }
    });

    // Push notifications: request permission + register once signed in on native; a signed-out
    // guest is never prompted. Independent of the realtime socket above — push is for when the app
    // is backgrounded/killed and the socket isn't connected, not a replacement for it.
    effect(() => {
      if (this.isNative && this.isAuthenticated()) {
        void this.pushNotificationsService
          .initialize()
          .then(() =>
            this.pushNotificationsService.createAndroidChannel(
              ASSIGNMENT_PUSH_CHANNEL,
            ),
          );
      }
    });

    // capacitor.config sets presentationOptions to [] so the OS shows no banner while the app is
    // open; a push that arrives in the foreground goes through the same de-duplicated in-app alert
    // as the Socket.IO event, so one offer never produces two alerts.
    effect(() => {
      const notification =
        this.pushNotificationsService.foregroundNotification();
      const assignment = assignmentFromPushData(notification?.data);
      if (assignment) {
        untracked(() => this.alertNewAssignment(assignment));
      }
    });

    // Without notification permission, offers only reach the partner while the app is open.
    effect(() => {
      if (this.pushNotificationsService.permissionState() === 'denied') {
        untracked(() =>
          this.toastService.showSnackbar({
            message:
              'Notifications are off. Turn them on in Settings to get delivery offers when the app is closed.',
            tone: 'warning',
            durationMs: 10_000,
          }),
        );
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

      // The partner already knows about this offer — don't alert again when the socket event or a
      // foreground push for it arrives. The Assignments screen re-fetches it from the backend, so
      // an expired or reassigned offer simply isn't offered for acceptance.
      const assignment = assignmentFromPushData(tapped.data);
      if (assignment) {
        this.rememberAlerted(assignment.assignmentId);
      }

      const routerPath = resolvePushTapRoute(tapped.data, {
        rootSegment: 'assignments',
      });
      if (routerPath) {
        void this.router.navigateByUrl(routerPath);
      }
    });
  }

  /** Registered once; RealtimeSocketService keeps them attached across reconnects and across
   *  logout → login (it re-attaches registered listeners to every new socket). */
  private registerRealtimeListeners(): void {
    if (this.realtimeListenersRegistered) {
      return;
    }
    this.realtimeListenersRegistered = true;

    this.realtimeSocketService.on('notification', () => {
      this._unreadNotifications.update((count) => count + 1);
      // Any notification could be a verification-status change — cheap to just refresh.
      this.currentDeliveryVerificationService.invalidate();
      void this.loadHeaderData();
    });

    this.realtimeSocketService.on<DeliveryAssignmentEvent>(
      'delivery.assignment',
      (event) => this.alertNewAssignment(event),
    );
  }

  /**
   * Foreground alert for a new offer. Deliberately carries no order details: the event only has
   * ids, and the Assignments screen re-fetches the authoritative assignment (ownership, PENDING
   * state, expiry) from the backend before showing Accept/Reject — this alert never acts on the
   * payload itself. Backgrounded/terminated delivery needs a push provider (see report).
   */
  private alertNewAssignment(event: DeliveryAssignmentEvent): void {
    if (
      !event?.assignmentId ||
      this.alertedAssignmentIds.includes(event.assignmentId)
    ) {
      return;
    }

    this.rememberAlerted(event.assignmentId);

    this.toastService.showSnackbar({
      message: 'New delivery assigned. Review it before the offer expires.',
      tone: 'info',
      durationMs: 15_000,
      action: {
        label: 'View',
        onAction: () => void this.router.navigateByUrl('/assignments'),
      },
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

  private rememberAlerted(assignmentId: string): void {
    if (this.alertedAssignmentIds.includes(assignmentId)) {
      return;
    }
    this.alertedAssignmentIds.push(assignmentId);
    if (this.alertedAssignmentIds.length > ALERTED_ASSIGNMENT_MEMORY) {
      this.alertedAssignmentIds.shift();
    }
  }

  protected async onLogout(): Promise<void> {
    // Remove this device's token from the account while the session is still valid, so a
    // logged-out device stops receiving this partner's offers. Best-effort: logout must never be
    // blocked by it (the native token is also unregistered by PushNotificationsService.reset()).
    const token = this.pushNotificationsService.token();
    if (token) {
      await this.notificationsService
        .notificationsControllerUnregisterPushToken({ body: { token } })
        .catch(() => undefined);
    }

    await this.authFacade.logout();
    await this.router.navigateByUrl('/auth/login');
  }
}
