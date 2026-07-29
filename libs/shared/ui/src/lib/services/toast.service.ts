import { Injectable, signal } from '@angular/core';
import type { NotificationConfig, NotificationEntry, NotificationVariant } from '../types/overlay.types';

const DEFAULT_DURATION_MS: Record<NotificationVariant, number> = {
  toast: 3000,
  snackbar: 5000,
};

let notificationIdSequence = 0;

/**
 * Single queue backing both `ToastComponent` and `SnackbarComponent` — they're the same
 * "transient message" concern with two different treatments (toast: glanceable, auto-dismiss
 * only; snackbar: can carry one action button, longer-lived), so one service owns the queue and
 * `ToastHostComponent` picks which presentational component to render per entry's `variant`.
 * Only one notification is shown at a time — a second call while one is visible queues behind it
 * rather than stacking, matching standard mobile UX (stacked toasts are visually noisy and get
 * missed).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue: NotificationEntry[] = [];
  private readonly currentEntry = signal<NotificationEntry | null>(null);
  private dismissTimer?: ReturnType<typeof setTimeout>;

  /** The notification currently on screen, if any — `ToastHostComponent` renders this. */
  readonly current = this.currentEntry.asReadonly();

  showToast(config: NotificationConfig): void {
    this.enqueue(config, 'toast');
  }

  showSnackbar(config: NotificationConfig): void {
    this.enqueue(config, 'snackbar');
  }

  /** No-op if `id` isn't the currently-visible entry (e.g. a stale timer from an already-replaced
   *  notification) — safe to call unconditionally from a close button. */
  dismiss(id: string): void {
    if (this.currentEntry()?.id !== id) {
      return;
    }

    this.advance();
  }

  private enqueue(config: NotificationConfig, variant: NotificationVariant): void {
    const entry: NotificationEntry = {
      variant,
      durationMs: DEFAULT_DURATION_MS[variant],
      ...config,
      id: `notification-${++notificationIdSequence}`,
    };

    this.queue.push(entry);

    if (!this.currentEntry()) {
      this.advance();
    }
  }

  private advance(): void {
    clearTimeout(this.dismissTimer);
    const next = this.queue.shift() ?? null;
    this.currentEntry.set(next);

    if (next) {
      this.dismissTimer = setTimeout(() => this.advance(), next.durationMs);
    }
  }
}
