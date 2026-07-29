import { Injectable } from '@angular/core';
import { OverlayStackService } from './overlay-stack.service';

/**
 * Opens a full/large-surface overlay (center or full-screen on mobile) — pair with
 * `ModalHostComponent` placed once near the app root (typically inside `MobileShellComponent`).
 *
 * @example
 * const ref = this.modalService.open(PhotoViewerComponent, { data: { photoUrl } });
 * const result = await ref.afterClosed();
 */
@Injectable({ providedIn: 'root' })
export class ModalService<TData = unknown, TResult = unknown> extends OverlayStackService<
  TData,
  TResult
> {}
