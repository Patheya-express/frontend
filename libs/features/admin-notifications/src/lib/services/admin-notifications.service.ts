import { Injectable, inject } from '@angular/core';
import {
  NotificationsService,
  type AdminNotificationResponseDto,
  type PaginatedAdminNotificationsResponseDto,
} from '@patheya-express-frontend/api-sdk';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

export interface GetAdminNotificationsQuery {
  page: number;
  limit: number;
  search?: string;
  type?: AdminNotificationResponseDto['type'];
  channel?: AdminNotificationResponseDto['channel'];
  status?: AdminNotificationResponseDto['status'];
  recipient?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationsService {
  private readonly notificationsService = inject(NotificationsService);

  async getNotifications(query: GetAdminNotificationsQuery): Promise<PaginatedAdminNotificationsResponseDto> {
    const response = await this.notificationsService.notificationsControllerGetAllForAdmin(query);
    return unwrap(response);
  }

  async getNotification(id: string): Promise<AdminNotificationResponseDto> {
    const response = await this.notificationsService.notificationsControllerGetByIdForAdmin({ id });
    return unwrap(response);
  }

  async retryNotification(id: string): Promise<AdminNotificationResponseDto> {
    const response = await this.notificationsService.notificationsControllerRetryNotification({ id });
    return unwrap(response);
  }
}
