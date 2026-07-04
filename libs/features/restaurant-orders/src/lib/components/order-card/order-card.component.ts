import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { OrderResponseDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent, OrderStatusBadgeComponent } from '@patheya-express-frontend/ui';
import { OrderItemsComponent } from '../order-items/order-items.component';
import { RestaurantOrdersFacade } from '../../facades/restaurant-orders.facade';

interface OrderCardActionConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface OrderCardActionDef {
  action: string;
  label: string;
  tone: 'primary' | 'danger';
  /** Present only for actions that must be confirmed before running. */
  confirmation?: OrderCardActionConfirmation;
  /** Runs the transition for this action. The single integration point with the Facade. */
  execute: (facade: RestaurantOrdersFacade, orderId: string) => Promise<void>;
}

/**
 * Dispatch is fully automatic on the backend (an event listener assigns a delivery partner
 * as soon as an order becomes READY_FOR_PICKUP) — there is no restaurant-triggered "hand off"
 * action. This derives a read-only status line from fields already on the order; the
 * restaurant workflow itself ends at READY_FOR_PICKUP.
 */
function getDispatchStatus(order: OrderResponseDto): string | null {
  switch (order.status) {
    case 'READY_FOR_PICKUP':
      return order.deliveryPartnerId ? 'Delivery partner assigned' : 'Waiting for delivery partner';
    case 'OUT_FOR_DELIVERY':
      return 'Picked up — out for delivery';
    default:
      return null;
  }
}

/**
 * Actions available per order status, plus how to run each one. Adding a future action
 * (Ready, Dispatch, ...) means adding one entry here — the component itself never grows,
 * since it only ever calls `actionDef.execute(...)` and never branches on the action name.
 */
const ORDER_CARD_ACTIONS: Partial<Record<OrderResponseDto['status'], OrderCardActionDef[]>> = {
  PENDING: [
    {
      action: 'accept',
      label: 'Accept',
      tone: 'primary',
      execute: (facade, orderId) => facade.acceptOrder(orderId),
    },
    {
      action: 'reject',
      label: 'Reject',
      tone: 'danger',
      confirmation: {
        title: 'Reject this order?',
        message: 'The customer will be notified that their order was rejected. This cannot be undone.',
        confirmLabel: 'Reject order',
        cancelLabel: 'Keep order',
      },
      execute: (facade, orderId) => facade.rejectOrder(orderId),
    },
  ],
  CONFIRMED: [
    {
      action: 'prepare',
      label: 'Start Preparing',
      tone: 'primary',
      execute: (facade, orderId) => facade.prepareOrder(orderId),
    },
  ],
  PREPARING: [
    {
      action: 'ready',
      label: 'Mark Ready for Pickup',
      tone: 'primary',
      execute: (facade, orderId) => facade.readyOrder(orderId),
    },
  ],
};

@Component({
  selector: 'lib-order-card',
  standalone: true,
  imports: [DatePipe, OrderStatusBadgeComponent, OrderItemsComponent, ConfirmDialogComponent],
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderCardComponent {
  @Input({ required: true }) order!: OrderResponseDto;

  private readonly facade = inject(RestaurantOrdersFacade);

  /** The action currently awaiting confirmation, if any. */
  protected pendingAction: OrderCardActionDef | null = null;

  protected get customerName(): string | null {
    const customer = this.order.customer;
    if (!customer) {
      return null;
    }
    return [customer.firstName, customer.lastName].filter(Boolean).join(' ');
  }

  protected get totalQuantity(): number {
    return this.order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  protected get dispatchStatus(): string | null {
    return getDispatchStatus(this.order);
  }

  protected get availableActions(): OrderCardActionDef[] {
    return ORDER_CARD_ACTIONS[this.order.status] ?? [];
  }

  protected get isProcessing(): boolean {
    return this.facade.processingOrderId() === this.order.id;
  }

  protected get pendingConfirmation(): OrderCardActionConfirmation | null {
    return this.pendingAction?.confirmation ?? null;
  }

  protected handleAction(actionDef: OrderCardActionDef): void {
    if (this.isProcessing) {
      return;
    }

    if (actionDef.confirmation) {
      this.pendingAction = actionDef;
      return;
    }

    void actionDef.execute(this.facade, this.order.id);
  }

  protected confirmPendingAction(): void {
    const actionDef = this.pendingAction;
    this.pendingAction = null;

    if (actionDef) {
      void actionDef.execute(this.facade, this.order.id);
    }
  }

  protected cancelPendingAction(): void {
    this.pendingAction = null;
  }
}
