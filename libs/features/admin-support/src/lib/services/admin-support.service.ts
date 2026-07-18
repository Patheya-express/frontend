import { Injectable, inject } from '@angular/core';
import {
  SupportTicketsService,
  PresenceService,
  type AdminTicketResponseDto,
  type PaginatedAdminTicketsResponseDto,
  type TicketResponseDto,
} from '@patheya-express-frontend/api-sdk';

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

export type AdminTicketStatusFilter = AdminTicketResponseDto['status'];
export type AdminTicketPriorityFilter = AdminTicketResponseDto['priority'];
export type AdminTicketCategoryFilter = AdminTicketResponseDto['category'];

export interface GetAdminTicketsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: AdminTicketStatusFilter;
  category?: AdminTicketCategoryFilter;
  priority?: AdminTicketPriorityFilter;
  assignedAgentId?: string;
  unassigned?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminSupportService {
  private readonly ticketsService = inject(SupportTicketsService);
  private readonly presenceService = inject(PresenceService);

  async getTickets(query: GetAdminTicketsQuery): Promise<PaginatedAdminTicketsResponseDto> {
    const response = await this.ticketsService.ticketsControllerGetAllForAdmin(query);
    return unwrap(response);
  }

  async getTicketById(id: string): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerGetTicketForAdmin({ id });
    return unwrap(response);
  }

  async assignTicket(id: string, agentId?: string): Promise<AdminTicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerAssignTicket({ id, body: { agentId } });
    return unwrap(response);
  }

  async updateStatus(id: string, status: AdminTicketStatusFilter, note?: string): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerUpdateStatus({ id, body: { status, note } });
    return unwrap(response);
  }

  async updatePriority(id: string, priority: AdminTicketPriorityFilter): Promise<void> {
    await this.ticketsService.ticketsControllerUpdatePriority({ id, body: { priority } });
  }

  async postMessage(id: string, message: string): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerPostMessage({ id, body: { message } });
    return unwrap(response);
  }

  async markAgentOnline(): Promise<void> {
    await this.presenceService.presenceControllerMarkAgentOnline();
  }

  async markAgentOffline(): Promise<void> {
    await this.presenceService.presenceControllerMarkAgentOffline();
  }

  async listOnlineAgents(): Promise<string[]> {
    // The generated SDK types this as void (the backend endpoint has no @ApiOkResponse type
    // annotation), but it returns the usual {success,timestamp,data} envelope at runtime.
    const response = await this.presenceService.presenceControllerListOnlineAgents();
    return unwrap(response as unknown as string[]);
  }
}
