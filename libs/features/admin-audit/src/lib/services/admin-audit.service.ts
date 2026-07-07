import { Injectable, inject } from '@angular/core';
import {
  AuditService,
  type AdminAuditLogResponseDto,
  type PaginatedAdminAuditLogsResponseDto,
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

export interface GetAdminAuditLogsQuery {
  page: number;
  limit: number;
  search?: string;
  action?: AdminAuditLogResponseDto['action'];
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Stateless backend orchestration for the admin audit log list. No mutating operations exist on this page. */
@Injectable({ providedIn: 'root' })
export class AdminAuditService {
  private readonly auditService = inject(AuditService);

  async getLogs(query: GetAdminAuditLogsQuery): Promise<PaginatedAdminAuditLogsResponseDto> {
    const response = await this.auditService.auditControllerGetAllForAdmin(query);
    return unwrap(response);
  }
}
