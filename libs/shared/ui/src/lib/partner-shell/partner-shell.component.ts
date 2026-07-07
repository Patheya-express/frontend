import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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
}
