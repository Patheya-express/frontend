import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogService } from '../../services/dialog.service';

/**
 * Renders every dialog opened via `DialogService.open()` — mount once, near the app root. Unlike
 * `ModalHostComponent`/`BottomSheetHostComponent`, this host provides **no backdrop/surface chrome
 * of its own** — `DialogService` content is expected to be fully self-presenting, the way
 * `ConfirmDialogComponent` already is (its own backdrop, centering, `role="alertdialog"`, Escape
 * is handled by its caller dismissing on Cancel). That's a deliberate contract, not a missing
 * feature: adding a second backdrop/surface here would double up with content that already draws
 * its own, which is exactly the "two implementations of one dialog" duplication this library
 * exists to avoid (see `ConfirmDialogOverlayComponent`). Content that instead wants generic
 * chrome provided for it should use `ModalService`/`ModalHostComponent`.
 */
@Component({
  selector: 'lib-dialog-host',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (entry of dialogService.entries(); track entry.id) {
      <ng-container
        [ngComponentOutlet]="entry.component"
        [ngComponentOutletInputs]="{ data: entry.config.data, overlayId: entry.id }"
      />
    }
  `,
})
export class DialogHostComponent {
  protected readonly dialogService = inject(DialogService);
}
