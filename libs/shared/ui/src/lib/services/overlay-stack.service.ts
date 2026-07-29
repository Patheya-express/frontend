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
  }

  closeAll(): void {
    for (const entry of this.stack()) {
      entry.resolveClose(undefined);
    }
    this.stack.set([]);
  }
}
