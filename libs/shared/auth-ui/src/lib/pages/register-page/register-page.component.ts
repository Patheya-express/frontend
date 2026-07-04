import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AuthCardComponent,
  AuthLayoutComponent,
  RegisterFormComponent,
  type RegisterFormValue,
} from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';

@Component({
  selector: 'lib-register-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, RegisterFormComponent, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly facade = inject(AuthFacade);
  private readonly router = inject(Router);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  protected async onSubmit(value: RegisterFormValue): Promise<void> {
    const success = await this.facade.register(value);

    if (success) {
      await this.router.navigateByUrl('/');
    }
  }
}
