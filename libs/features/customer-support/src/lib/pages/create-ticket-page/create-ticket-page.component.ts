import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerSupportFacade } from '../../facades/customer-support.facade';
import type { TicketCategory, TicketPriority } from '../../services/customer-support.service';

const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'ORDER_ISSUE', label: 'Order issue' },
  { value: 'PAYMENT_ISSUE', label: 'Payment issue' },
  { value: 'REFUND_REQUEST', label: 'Refund request' },
  { value: 'CANCELLATION_REQUEST', label: 'Cancellation request' },
  { value: 'ACCOUNT_ISSUE', label: 'Account issue' },
  { value: 'GENERAL', label: 'General' },
];

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

@Component({
  selector: 'lib-create-ticket-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-ticket-page.component.html',
  styleUrl: './create-ticket-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTicketPageComponent {
  protected readonly facade = inject(CustomerSupportFacade);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    category: this.fb.nonNullable.control<TicketCategory>('GENERAL', Validators.required),
    priority: this.fb.nonNullable.control<TicketPriority>('MEDIUM'),
    subject: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    description: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(10)]),
    orderId: this.fb.nonNullable.control(''),
  });

  protected async submit(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();

    const ticket = await this.facade.createTicket({
      category: value.category,
      priority: value.priority,
      subject: value.subject,
      description: value.description,
      orderId: value.orderId || undefined,
    });

    if (ticket) {
      void this.router.navigate(['/support/tickets', ticket.id]);
    }
  }
}
