import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface CtaAction {
  label: string;
  routerLink: string;
  variant: 'primary' | 'secondary';
}

@Component({
  selector: 'lib-cta-section',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cta-section.component.html',
  styleUrl: './cta-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CtaSectionComponent {
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() actions: CtaAction[] = [];
}
