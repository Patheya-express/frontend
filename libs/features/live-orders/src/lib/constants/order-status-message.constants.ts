import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';

/**
 * Compact, present-tense description of what's happening with an active order right now — the
 * tracker's secondary line whenever no authoritative ETA is available (which, per
 * live-orders-floating-tracker.component.ts's own doc comment, is always: OrderResponseDto has no
 * ETA field, and fetching one requires a separate per-order tracking API call this tracker must
 * not make). Wording deliberately doesn't conflict with the existing per-step timeline labels
 * (OrderStatusTimelineComponent's STEP_LABELS, e.g. "Preparing your food") or the compact
 * OrderStatusBadgeComponent labels (e.g. "Preparing") — both describe the same status from a
 * slightly different angle (a completed timeline step vs. a short badge), duplicated here only
 * because those two are private to `order-details`, a lazy-loaded library this eagerly-loaded one
 * cannot statically depend on (see active-orders.service.ts's own doc comment for the same
 * constraint on the customer-orders endpoint).
 */
const ORDER_STATUS_MESSAGES: Partial<Record<OrderResponseDto['status'], string>> = {
  PENDING: 'Waiting for restaurant confirmation',
  CONFIRMED: 'Restaurant accepted your order',
  PREPARING: 'Your order is being prepared',
  READY_FOR_PICKUP: 'Order is ready for pickup',
  OUT_FOR_DELIVERY: 'Your order is on the way',
};

/** Empty for a status this map has nothing to say about (i.e. a terminal status — DELIVERED/
 *  CANCELLED never reach the tracker in the first place, since LiveOrdersStore already excludes
 *  them) rather than throwing, so a future backend status the frontend doesn't know about yet
 *  degrades to "no secondary line" instead of a crash. */
export function orderStatusMessage(status: OrderResponseDto['status']): string {
  return ORDER_STATUS_MESSAGES[status] ?? '';
}
