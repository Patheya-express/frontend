import { Injectable, inject } from '@angular/core';
import type { CreateTicketDto } from '@patheya-express-frontend/api-sdk';
import { CustomerSupportStore } from '../store/customer-support.store';
import type { TicketCategory, TicketStatus } from '../services/customer-support.service';

@Injectable({ providedIn: 'root' })
export class CustomerSupportFacade {
  private readonly store = inject(CustomerSupportStore);

  readonly tickets = this.store.tickets;
  readonly total = this.store.total;
  readonly page = this.store.page;
  readonly totalPages = this.store.totalPages;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly statusFilter = this.store.statusFilter;
  readonly categoryFilter = this.store.categoryFilter;

  readonly selectedTicket = this.store.selectedTicket;
  readonly selectedTicketLoading = this.store.selectedTicketLoading;
  readonly selectedTicketError = this.store.selectedTicketError;
  readonly sendingMessage = this.store.sendingMessage;

  readonly creating = this.store.creating;
  readonly createError = this.store.createError;

  readonly faqs = this.store.faqs;
  readonly faqsLoading = this.store.faqsLoading;

  loadTickets(page?: number): Promise<void> {
    return this.store.loadTickets(page);
  }

  setStatusFilter(status: TicketStatus | undefined): void {
    this.store.setStatusFilter(status);
  }

  setCategoryFilter(category: TicketCategory | undefined): void {
    this.store.setCategoryFilter(category);
  }

  createTicket(dto: CreateTicketDto) {
    return this.store.createTicket(dto);
  }

  loadTicketById(id: string): Promise<void> {
    return this.store.loadTicketById(id);
  }

  postMessage(id: string, message: string): Promise<void> {
    return this.store.postMessage(id, message);
  }

  uploadAttachment(id: string, file: File): Promise<void> {
    return this.store.uploadAttachment(id, file);
  }

  closeTicket(id: string): Promise<void> {
    return this.store.closeTicket(id);
  }

  loadFaqs(category?: string): Promise<void> {
    return this.store.loadFaqs(category);
  }
}
