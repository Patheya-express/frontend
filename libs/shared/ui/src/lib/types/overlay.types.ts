import type { Type } from '@angular/core';
import type { MobileTone } from './common.types';

/** Options shared by Modal/Bottom Sheet/Dialog — each service's `open()` accepts this plus
 *  whatever `@Input()`s the projected component declares. */
export interface OverlayConfig<TData = unknown> {
  /** Passed to the projected component as its `data` input (see `OverlayHostBase.data`). */
  data?: TData;
  /** Backdrop click / swipe-down-to-dismiss (bottom sheet) closes with `undefined`. Default true. */
  dismissible?: boolean;
  /** Read by screen readers for the overlay's role/label — required for a11y (see docs §8). */
  ariaLabel?: string;
}

/** Internal bookkeeping for one open overlay — created by `OverlayStackService.open()`, consumed
 *  by the matching host component's `@for` loop. Not part of the public API (services return an
 *  `OverlayRef`, hosts read `entries()`); exported only because generics need it at call sites. */
export interface OverlayEntry<TData = unknown, TResult = unknown> {
  id: string;
  component: Type<unknown>;
  config: OverlayConfig<TData>;
  resolveClose: (result: TResult | undefined) => void;
}

/** What every `*Service.open()` call returns — the caller's handle to the overlay it just opened. */
export interface OverlayRef<TResult = unknown> {
  id: string;
  close(result?: TResult): void;
  afterClosed(): Promise<TResult | undefined>;
}

export type NotificationVariant = 'toast' | 'snackbar';

export interface NotificationAction {
  label: string;
  onAction: () => void;
}

export interface NotificationConfig {
  message: string;
  tone?: MobileTone;
  /** ms before auto-dismiss. Toasts default to 3000, snackbars (which may carry an action) to 5000. */
  durationMs?: number;
  /** Snackbars only — toasts never carry an interactive action (keeps them non-blocking/glanceable). */
  action?: NotificationAction;
}

export interface NotificationEntry extends NotificationConfig {
  id: string;
  variant: NotificationVariant;
}
