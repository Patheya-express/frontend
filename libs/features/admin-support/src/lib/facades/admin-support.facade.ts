import { Injectable, inject } from '@angular/core';
import { AdminSupportStore } from '../store/admin-support.store';
import type {
  AdminTicketCategoryFilter,
  AdminTicketPriorityFilter,
  AdminTicketStatusFilter,
} from '../services/admin-support.service';

@Injectable({ providedIn: 'root' })
export class AdminSupportFacade {
  private readonly store = inject(AdminSupportStore);

  readonly tickets = this.store.tickets;
  readonly pagination = this.store.pagination;
  readonly filters = this.store.filters;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly selectedTicket = this.store.selectedTicket;
  readonly selectedTicketLoading = this.store.selectedTicketLoading;
  readonly actionBusy = this.store.actionBusy;
  readonly actionError = this.store.actionError;

  readonly online = this.store.online;
  readonly newTicketCount = this.store.newTicketCount;
  readonly currentAgentId = this.store.currentAgentId;

  loadTickets(page?: number): Promise<void> {
    return this.store.loadTickets(page);
  }

  setSearch(search: string): void {
    this.store.setSearch(search);
  }

  setStatusFilter(status: AdminTicketStatusFilter | null): void {
    this.store.setStatusFilter(status);
  }

  setCategoryFilter(category: AdminTicketCategoryFilter | null): void {
    this.store.setCategoryFilter(category);
  }

  setPriorityFilter(priority: AdminTicketPriorityFilter | null): void {
    this.store.setPriorityFilter(priority);
  }

  setUnassignedOnly(unassigned: boolean): void {
    this.store.setUnassignedOnly(unassigned);
  }

  setPage(page: number): void {
    this.store.setPage(page);
  }

  selectTicket(id: string): Promise<void> {
    return this.store.selectTicket(id);
  }

  closeSelectedTicket(): void {
    this.store.closeSelectedTicket();
  }

  assignToMe(ticketId: string): Promise<void> {
    return this.store.assignToMe(ticketId);
  }

  updateStatus(ticketId: string, status: AdminTicketStatusFilter): Promise<void> {
    return this.store.updateStatus(ticketId, status);
  }

  updatePriority(ticketId: string, priority: AdminTicketPriorityFilter): Promise<void> {
    return this.store.updatePriority(ticketId, priority);
  }

  postMessage(ticketId: string, message: string): Promise<void> {
    return this.store.postMessage(ticketId, message);
  }

  toggleOnline(): Promise<void> {
    return this.store.toggleOnline();
  }
}
