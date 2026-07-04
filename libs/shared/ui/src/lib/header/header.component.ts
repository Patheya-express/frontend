import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartBadgeComponent } from '../cart-badge/cart-badge.component';

@Component({
  selector: 'lib-header',
  standalone: true,
  imports: [RouterLink, CartBadgeComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @Input() isAuthenticated = false;
  @Input() cartItemCount = 0;
  @Output() logoutRequested = new EventEmitter<void>();
  @Output() cartToggled = new EventEmitter<void>();

  protected readonly menuOpen = signal(false);

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onLogout(): void {
    this.menuOpen.set(false);
    this.logoutRequested.emit();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}
