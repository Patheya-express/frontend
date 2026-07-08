import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'lib-app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
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
}
