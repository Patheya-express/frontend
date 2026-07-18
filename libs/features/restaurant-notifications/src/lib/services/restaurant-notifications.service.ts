import { Injectable, inject } from '@angular/core';
import {
  NotificationsService,
  type MarkAllReadResponseDto,
  type NotificationResponseDto,
  type NotificationsControllerGetMyNotifications$Params,
  type PaginatedNotificationsResponseDto,
  type UnreadCountResponseDto,
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

export type GetRestaurantNotificationsParams = NotificationsControllerGetMyNotifications$Params;

/**
 * Stateless backend orchestration for the restaurant-app Notification Center. Notifications are
 * already recipient-scoped server-side (see RestaurantOrderNotificationListener) — this calls
 * the same generic "my notifications" endpoint every app uses, just from restaurant-app.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantNotificationsFeatureService {
  private readonly notificationsService = inject(NotificationsService);

  async getMyNotifications(
    params: GetRestaurantNotificationsParams,
  ): Promise<PaginatedNotificationsResponseDto> {
    const response = await this.notificationsService.notificationsControllerGetMyNotifications(params);
    return unwrap(response);
  }

  async getMyNotificationById(id: string): Promise<NotificationResponseDto> {
    const response = await this.notificationsService.notificationsControllerGetMyNotificationById({ id });
    return unwrap(response);
  }

  async markAsRead(id: string): Promise<NotificationResponseDto> {
    const response = await this.notificationsService.notificationsControllerMarkMyNotificationAsRead({ id });
    return unwrap(response);
  }

  async markAllAsRead(): Promise<MarkAllReadResponseDto> {
    const response = await this.notificationsService.notificationsControllerMarkAllMyNotificationsAsRead();
    return unwrap(response);
  }

  async getUnreadCount(): Promise<UnreadCountResponseDto> {
    const response = await this.notificationsService.notificationsControllerGetMyUnreadCount();
    return unwrap(response);
  }
}
