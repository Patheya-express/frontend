import { Injectable, inject } from '@angular/core';
import { AdminService, type AdminDashboardResponseDto } from '@patheya-express-frontend/api-sdk';

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

/** Stateless backend orchestration for the admin dashboard. */
@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly adminService = inject(AdminService);

  async getDashboard(): Promise<AdminDashboardResponseDto> {
    const response = await this.adminService.adminControllerGetDashboard();
    return unwrap(response);
  }
}
