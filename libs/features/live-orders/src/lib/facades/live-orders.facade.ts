import { Injectable, inject } from '@angular/core';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { LiveOrdersStore } from '../store/live-orders.store';

@Injectable({ providedIn: 'root' })
export class LiveOrdersFacade {
  private readonly store = inject(LiveOrdersStore);

  /** Newest-first, capped at 3 — what the floating tracker renders. */
  readonly trackedOrders = this.store.trackedOrders;

  /** Loads the signed-in customer's active orders and starts realtime tracking. Call once, at app
   *  root, when authenticated (mirrors CartFacade.restore()/CustomerProfileFacade.ensureProfileLoaded()). */
  initialize(): void {
    void this.store.initialize();
  }

  /** Makes a just-placed order visible in the tracker immediately, without waiting on a refetch. */
  upsertOrder(order: OrderResponseDto): void {
    this.store.upsertOrder(order);
  }
}
