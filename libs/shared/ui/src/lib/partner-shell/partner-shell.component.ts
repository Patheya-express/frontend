import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MOBILE_PAGE_TRANSITION } from '../animations/page-transition.animation';

export interface PartnerNavLink {
  label: string;
  path: string;
}

/**
 * Lightweight authenticated-area shell for partner-facing apps (restaurant, delivery) — brand
 * name, app-specific nav links, and a logout action. Deliberately separate from AppShellComponent,
 * which is customer-app specific (cart badge, search bar, location picker).
 */
@Component({
  selector: 'lib-partner-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './partner-shell.component.html',
  styleUrl: './partner-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerShellComponent {
  @Input({ required: true }) brandName!: string;
  @Input() navLinks: PartnerNavLink[] = [];
  @Output() logoutRequested = new EventEmitter<void>();

  @ViewChild('pageContent') private readonly pageContent?: ElementRef<HTMLElement>;

  /** See AppShellComponent.onRouteActivate's doc comment — identical technique, kept in sync
   *  manually since these two shells intentionally don't share a base class. */
  protected onRouteActivate(): void {
    const el = this.pageContent?.nativeElement;
    if (!el) {
      return;
    }
    el.classList.remove(MOBILE_PAGE_TRANSITION.enter);
    void el.offsetWidth;
    el.classList.add(MOBILE_PAGE_TRANSITION.enter);
  }
}
