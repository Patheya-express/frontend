import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { CustomerProfileFacade } from '@patheya-express-frontend/customer-profile';

@Component({
  selector: 'lib-delete-account-section',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './delete-account-section.component.html',
  styleUrl: './delete-account-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountSectionComponent {
  private readonly facade = inject(CustomerProfileFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);

  protected readonly confirming = signal(false);
  protected readonly deleting = this.facade.deleting;

  protected requestDelete(): void {
    this.confirming.set(true);
  }

  protected cancelDelete(): void {
    this.confirming.set(false);
  }

  protected async confirmDelete(): Promise<void> {
    const ok = await this.facade.deleteAccount();

    if (ok) {
      await this.authFacade.logout();
      await this.router.navigate(['/']);
    } else {
      this.confirming.set(false);
    }
  }
}
