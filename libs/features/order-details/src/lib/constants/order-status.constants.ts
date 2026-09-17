import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';

/**
 * The two terminal points of the order lifecycle (OrdersService/OrderStatus on the backend) — once
 * an order reaches either, it never transitions again. Shared by OrderDetailsStore (stops polling)
 * and LiveOrdersStore (drops the order from the floating tracker) so the two stores can never
 * disagree on what "terminal" means.
 */
export const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderResponseDto['status']> = [
  'DELIVERED',
  'CANCELLED',
];

export function isTerminalOrderStatus(status: OrderResponseDto['status']): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}
