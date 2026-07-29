import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModalHostComponent } from '../../../overlays/modal-host/modal-host.component';
import { BottomSheetHostComponent } from '../../../overlays/bottom-sheet-host/bottom-sheet-host.component';
import { DialogHostComponent } from '../../../overlays/dialog-host/dialog-host.component';
import { ToastHostComponent } from '../../../overlays/toast-host/toast-host.component';
import { OfflineBannerComponent } from '../../../offline-banner/offline-banner.component';

/**
 * The single "drop this at the app root" component: wires up every overlay host (Modal/Bottom
 * Sheet/Dialog/Toast) plus the offline banner, so individual screens/apps never have to remember
 * to mount each one separately. Structural slots are named content projection so each app keeps
 * full control of what actually goes in its top app bar / bottom tabs — this component owns
 * layout plumbing only, never app-specific chrome content (no business logic, no fixed nav items).
 *
 * @example
 * <!-- apps/customer-app/src/app/app.html, once a mobile screen build starts consuming this -->
 * <mobile-shell>
 *   <mobile-top-app-bar mobileTopAppBar title="Patheya Express" />
 *   <router-outlet />
 *   <mobile-bottom-tabs mobileBottomTabs [tabs]="tabs" />
 * </mobile-shell>
 */
@Component({
  selector: 'mobile-shell',
  standalone: true,
  imports: [
    ModalHostComponent,
    BottomSheetHostComponent,
    DialogHostComponent,
    ToastHostComponent,
    OfflineBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mobile-shell">
      <ng-content select="[mobileTopAppBar]" />
      <lib-offline-banner />
      <main class="mobile-shell__content">
        <ng-content />
      </main>
      <ng-content select="[mobileBottomTabs]" />
    </div>
    <lib-modal-host />
    <lib-bottom-sheet-host />
    <lib-dialog-host />
    <lib-toast-host />
  `,
  styles: `
    .mobile-shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
    }

    .mobile-shell__content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
  `,
})
export class MobileShellComponent {}
