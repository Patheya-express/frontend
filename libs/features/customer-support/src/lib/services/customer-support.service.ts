import { Injectable, inject } from '@angular/core';
import {
  SupportTicketsService,
  HelpCenterFaQsService,
  type CreateTicketDto,
  type FaqResponseDto,
  type PaginatedTicketsResponseDto,
  type TicketResponseDto,
  type TicketSummaryDto,
} from '@patheya-express-frontend/api-sdk';

// The generated SDK inlines these as string-literal unions on each DTO rather than exporting a
// standalone enum type — these aliases give the rest of this lib one shared name to import.
export type TicketCategory = TicketSummaryDto['category'];
export type TicketPriority = TicketSummaryDto['priority'];
export type TicketStatus = TicketSummaryDto['status'];

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

export interface GetMyTicketsParams {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  category?: TicketCategory;
}

@Injectable({ providedIn: 'root' })
export class CustomerSupportService {
  private readonly ticketsService = inject(SupportTicketsService);
  private readonly faqService = inject(HelpCenterFaQsService);

  async createTicket(dto: CreateTicketDto): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerCreateTicket({ body: dto });
    return unwrap(response);
  }

  async getMyTickets(params: GetMyTicketsParams): Promise<PaginatedTicketsResponseDto> {
    const response = await this.ticketsService.ticketsControllerGetMyTickets(params);
    return unwrap(response);
  }

  async getMyTicketById(id: string): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerGetMyTicketById({ id });
    return unwrap(response);
  }

  async closeTicket(id: string): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerCloseMyTicket({ id });
    return unwrap(response);
  }

  async postMessage(id: string, message: string): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerPostMessage({ id, body: { message } });
    return unwrap(response);
  }

  async uploadAttachment(id: string, file: File): Promise<TicketResponseDto> {
    const response = await this.ticketsService.ticketsControllerUploadAttachment({ id, body: { file } });
    return unwrap(response);
  }

  async getFaqs(category?: string): Promise<FaqResponseDto[]> {
    const response = await this.faqService.faqControllerFindActive({ category });
    return unwrap(response);
  }
}
