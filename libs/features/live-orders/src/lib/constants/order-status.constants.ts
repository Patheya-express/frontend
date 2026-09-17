import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';

/**
 * The two terminal points of the order lifecycle (OrdersService/OrderStatus on the backend) — once
 * an order reaches either, it never transitions again. Mirrors order-details's own
 * TERMINAL_ORDER_STATUSES (order-details.store.ts) — not imported from there directly because
 * order-details is lazy-loaded via app.routes.ts (`/orders`, `/orders/:orderId`) while this
 * library is loaded eagerly at the app shell (see app.ts), and Nx's module-boundary rule forbids a
 * static import of a lazy-loaded library from an eager context.
 */
export const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = [
  'DELIVERED',
  'CANCELLED',
];

export function isTerminalOrderStatus(status: OrderResponseDto['status']): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}
