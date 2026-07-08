import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { NotificationResponseDto } from '@patheya-express-frontend/api-sdk';
import { CustomerNotificationsFacade, CustomerNotificationsService } from '@patheya-express-frontend/customer-notifications';
import { ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';

@Component({
  selector: 'lib-notification-detail-page',
  standalone: true,
  imports: [DatePipe, RouterLink, SkeletonComponent, ErrorStateComponent],
  templateUrl: './notification-detail-page.component.html',
  styleUrl: './notification-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly notificationsService = inject(CustomerNotificationsService);
  private readonly facade = inject(CustomerNotificationsFacade);

  protected readonly notification = signal<NotificationResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private notificationId = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.notificationId = id;
        void this.load(id);
      }
    });
  }

  protected retry(): void {
    if (this.notificationId) {
      void this.load(this.notificationId);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.notificationsService.getMyNotificationById(id);
      this.notification.set(result);

      if (result.status !== 'READ') {
        void this.facade.markAsRead(id);
      }
    } catch {
      this.error.set('Unable to load this notification. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
