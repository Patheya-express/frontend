import { Injectable, inject } from '@angular/core';
import {
  DeliveryService,
  DispatchService,
  PresenceService,
  type DeliveryAssignmentResponseDto,
  type DeliveryPartnerResponseDto,
  type OrderResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { CurrentDeliveryPartnerService } from '@patheya-express-frontend/core';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

/**
 * Stateless backend orchestration for the delivery partner dashboard.
 *
 * "Online" is currently two disconnected backend systems: `DeliveryPartnerStatus` (a durable
 * DB flag toggled via /delivery/available|offline) and Redis presence (the flag dispatch
 * assignment actually checks, toggled via /presence/online|offline). Going online/offline
 * here updates both together so the toggle has real effect on receiving assignments.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryDashboardService {
  private readonly deliveryService = inject(DeliveryService);
  private readonly dispatchService = inject(DispatchService);
  private readonly presenceService = inject(PresenceService);
  private readonly currentPartner = inject(CurrentDeliveryPartnerService);

  getPartner(): Promise<DeliveryPartnerResponseDto> {
    return this.currentPartner.getPartner();
  }

  async getAssignedOrders(): Promise<OrderResponseDto[]> {
    const response = await this.deliveryService.deliveryControllerGetAssignedOrders();
    return unwrap(response);
  }

  async getMyAssignments(): Promise<DeliveryAssignmentResponseDto[]> {
    const response = await this.dispatchService.dispatchControllerGetAssignments();
    return unwrap(response);
  }

  /**
   * Always-on presence heartbeat (2026-09-16 follow-up) — `location`, when available, is passed
   * through to both calls so a rider's current position is on file from the very first moment
   * they go online, not just from whenever the first heartbeat happens to land (see
   * pingOnline()'s own doc comment for why the heartbeat keeps refreshing it afterward).
   */
  async goOnline(
    location?: { latitude: number; longitude: number },
  ): Promise<DeliveryPartnerResponseDto> {
    const [partnerResponse] = await Promise.all([
      this.deliveryService.deliveryControllerGoAvailable(
        location ? { body: location } : undefined,
      ),
      this.presenceService.presenceControllerMarkOnline(
        location ? { body: location } : undefined,
      ),
    ]);
    this.currentPartner.invalidate();
    return unwrap(partnerResponse);
  }

  async goOffline(): Promise<DeliveryPartnerResponseDto> {
    const [partnerResponse] = await Promise.all([
      this.deliveryService.deliveryControllerGoOffline(),
      this.presenceService.presenceControllerMarkOffline(),
    ]);
    this.currentPartner.invalidate();
    return unwrap(partnerResponse);
  }

  /**
   * Presence Heartbeat Hardening — the heartbeat's repeated action. Deliberately only refreshes
   * the Redis presence TTL, unlike goOnline() above: `deliveryControllerGoAvailable()` (the
   * durable DB status flip) only needs to happen once, on the initial toggle, not every interval
   * tick.
   *
   * Always-on presence heartbeat (2026-09-16 follow-up) — `location`, when available, rides
   * along on this same already-periodic call so `DeliveryPartner.currentLatitude/currentLongitude`
   * never goes more than one heartbeat interval stale while the rider is online — this is what
   * makes location "always accessible unless offline or logged out" true, since the heartbeat
   * itself already only runs during that exact window (see DeliveryDashboardStore).
   */
  pingOnline(location?: {
    latitude: number;
    longitude: number;
  }): Promise<void> {
    return this.presenceService
      .presenceControllerMarkOnline(location ? { body: location } : undefined)
      .then(() => undefined);
  }
}
