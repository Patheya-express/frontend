import { signal, Type } from '@angular/core';
import type { OverlayConfig, OverlayEntry, OverlayRef } from '../types/overlay.types';

let overlayIdSequence = 0;

/**
 * Shared open/close/stack bookkeeping for Modal, Bottom Sheet and Dialog — the three overlay
 * kinds differ only in their host component's chrome/animation/UX affordance, not in "how do I
 * track which ones are open and resolve their close promise", so that logic lives here once
 * instead of being copy-pasted three times. Not itself `@Injectable`; each concrete service
 * (`ModalService`, `BottomSheetService`, `DialogService`) extends it and carries its own
 * `@Injectable({ providedIn: 'root' })`, so the three still resolve to independent singleton
 * stacks (a bottom sheet and a dialog can be open at once, each tracked separately).
 */
export abstract class OverlayStackService<TData = unknown, TResult = unknown> {
  private readonly stack = signal<OverlayEntry<TData, TResult>[]>([]);

  /** The element focused right before each still-open overlay was opened, keyed by overlay id —
   *  restored on close so keyboard/screen-reader focus returns to what triggered the overlay
   *  instead of being lost to `<body>`. */
  private readonly triggerElements = new Map<string, HTMLElement | null>();

  /** Every currently-open overlay of this kind, oldest first. The matching host component
   *  renders one per entry via `@for` (typically just zero or one, but stacking is supported). */
  readonly entries = this.stack.asReadonly();

  open(component: Type<unknown>, config: OverlayConfig<TData> = {}): OverlayRef<TResult> {
    const id = `overlay-${++overlayIdSequence}`;
    let resolveClose!: (result: TResult | undefined) => void;
    const closed = new Promise<TResult | undefined>((resolve) => {
      resolveClose = resolve;
    });

    const entry: OverlayEntry<TData, TResult> = {
      id,
      component,
      config: { dismissible: true, ...config },
      resolveClose,
    };

    this.triggerElements.set(
      id,
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    this.stack.update((current) => [...current, entry]);

    return {
      id,
      close: (result?: TResult) => this.close(id, result),
      afterClosed: () => closed,
    };
  }

  close(id: string, result?: TResult): void {
    const entry = this.stack().find((item) => item.id === id);
    if (!entry) {
      return;
    }

    this.stack.update((current) => current.filter((item) => item.id !== id));
    entry.resolveClose(result);
    this.restoreFocus(id);
  }

  closeAll(): void {
    for (const entry of this.stack()) {
      entry.resolveClose(undefined);
      this.restoreFocus(entry.id);
    }
    this.stack.set([]);
  }

  private restoreFocus(id: string): void {
    const trigger = this.triggerElements.get(id);
    this.triggerElements.delete(id);
    trigger?.focus({ preventScroll: true });
  }
}
