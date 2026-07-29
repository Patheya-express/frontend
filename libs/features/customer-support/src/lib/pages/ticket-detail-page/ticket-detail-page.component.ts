import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  FileUploadComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
  SkeletonComponent,
} from '@patheya-express-frontend/ui';
import { CustomerSupportFacade } from '../../facades/customer-support.facade';

@Component({
  selector: 'lib-ticket-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    FileUploadComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
  ],
  templateUrl: './ticket-detail-page.component.html',
  styleUrl: './ticket-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketDetailPageComponent implements OnInit {
  protected readonly facade = inject(CustomerSupportFacade);
  private readonly route = inject(ActivatedRoute);

  protected readonly draftMessage = signal('');
  protected readonly uploading = signal(false);

  private get ticketId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    void this.facade.loadTicketById(this.ticketId);
  }

  protected async sendMessage(): Promise<void> {
    const message = this.draftMessage().trim();

    if (!message) {
      return;
    }

    await this.facade.postMessage(this.ticketId, message);
    this.draftMessage.set('');
  }

  protected async onFileSelected(file: File): Promise<void> {
    this.uploading.set(true);

    try {
      await this.facade.uploadAttachment(this.ticketId, file);
    } finally {
      this.uploading.set(false);
    }
  }

  protected async closeTicket(): Promise<void> {
    await this.facade.closeTicket(this.ticketId);
  }

  protected retry(): void {
    void this.facade.loadTicketById(this.ticketId);
  }

  protected isTerminal(status: string | undefined): boolean {
    return status === 'RESOLVED' || status === 'CLOSED';
  }
}
