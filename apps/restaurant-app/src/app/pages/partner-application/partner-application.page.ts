import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthCardComponent, AuthLayoutComponent } from '@patheya-express-frontend/ui';

@Component({
  selector: 'app-partner-application-page',
  standalone: true,
  imports: [AuthLayoutComponent, AuthCardComponent, RouterLink],
  templateUrl: './partner-application.page.html',
  styleUrl: './partner-application.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerApplicationPageComponent {}
