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
import { NotificationBadgeComponent } from '../notification-badge/notification-badge.component';

@Component({
  selector: 'lib-header',
  standalone: true,
  imports: [RouterLink, CartBadgeComponent, NotificationBadgeComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @Input() isAuthenticated = false;
  @Input() cartItemCount = 0;
  @Input() notificationCount = 0;
  @Input() deliveryLocationLabel = 'Select a location';
  @Input() searchValue = '';
  @Input() avatarUrl?: string;
  @Input() firstName = '';

  @Output() logoutRequested = new EventEmitter<void>();
  @Output() cartToggled = new EventEmitter<void>();
  @Output() notificationsToggled = new EventEmitter<void>();
  @Output() locationPickerClicked = new EventEmitter<void>();
  @Output() searchSubmitted = new EventEmitter<string>();

  protected readonly menuOpen = signal(false);

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected get avatarInitial(): string {
    return this.firstName.charAt(0).toUpperCase();
  }

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

  protected onSearchSubmit(value: string): void {
    this.searchSubmitted.emit(value);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}
