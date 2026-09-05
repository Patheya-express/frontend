import { Injectable } from '@angular/core';
import type { DeliveryAssignmentResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  OfflineCache,
  type CacheReadResult,
} from '@patheya-express-frontend/mobile-offline';

const CACHE_KEY = 'patheya.cache.delivery.active-assignment';

/**
 * Bumped whenever `DeliveryAssignmentResponseDto`'s shape changes in a way that would make an
 * old cached entry unsafe to deserialize as the current type — `OfflineCache` discards anything
 * written under a different version rather than trusting it. There is no migration framework;
 * per M3 scope, a version bump plus safe invalidation is enough for a single cached value.
 */
const CACHE_VERSION = 1;

/**
 * How long a cached active assignment is presented as current (`isStale: false`) before it must
 * be shown with an explicit stale indicator. No TTL convention existed anywhere else in the repo
 * to reuse (checked as part of M2/M3). Five minutes is a conservative choice sized to what this
 * cache actually needs to survive — a temporary network drop, an app restart mid-delivery, a
 * short dead zone — not to stand in for a live connection indefinitely; the existing assignment
 * poll interval is 15s, so five minutes is already a large multiple of how fresh this data
 * normally is. Expiry never deletes the entry — see `OfflineCache`'s own doc comment — it only
 * flips `isStale`, and a stale entry is still exactly what M3.4's "offline, no fresh data
 * available" cold-start case is for.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Persists the delivery partner's single currently-active assignment (accepted, order not yet in
 * a terminal state) so `DeliveryAssignmentsStore` can restore something useful after an app
 * restart or a cold start with no connectivity — the audit's primary M3 finding. Deliberately
 * scoped to one assignment, not the whole assignment list: available offers and completed history
 * don't need offline resilience (an offer shown while offline could already be gone by the time
 * connectivity returns, which would be actively misleading), and re-fetching them once online is
 * cheap. Reuses the existing generated `DeliveryAssignmentResponseDto` model rather than a new
 * cache-specific type, since it's already exactly the shape the assignment list/detail UI
 * consumes — see that model's own fields for what is and isn't cached (no payment data, no auth
 * data; the nested order/customer/restaurant summaries are the same ones already shown on-screen
 * to this same authenticated delivery partner today).
 */
@Injectable({ providedIn: 'root' })
export class ActiveAssignmentCacheService {
  private readonly cache = new OfflineCache<DeliveryAssignmentResponseDto>(
    CACHE_KEY,
    CACHE_VERSION,
    CACHE_TTL_MS,
  );

  read(): Promise<CacheReadResult<DeliveryAssignmentResponseDto> | null> {
    return this.cache.read();
  }

  write(assignment: DeliveryAssignmentResponseDto): Promise<void> {
    return this.cache.write(assignment);
  }

  clear(): Promise<void> {
    return this.cache.clear();
  }
}
