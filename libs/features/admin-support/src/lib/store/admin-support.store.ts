import { Injectable, computed, inject, signal } from '@angular/core';
import type { AdminTicketResponseDto, TicketResponseDto } from '@patheya-express-frontend/api-sdk';
import { AuthFacade } from '@patheya-express-frontend/auth';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import {
  AdminSupportService,
  type AdminTicketCategoryFilter,
  type AdminTicketPriorityFilter,
  type AdminTicketStatusFilter,
} from '../services/admin-support.service';

export interface AdminSupportFilters {
  search: string;
  status: AdminTicketStatusFilter | null;
  category: AdminTicketCategoryFilter | null;
  priority: AdminTicketPriorityFilter | null;
  unassigned: boolean;
}

export interface AdminSupportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGINATION: AdminSupportPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const DEFAULT_FILTERS: AdminSupportFilters = {
  search: '',
  status: null,
  category: null,
  priority: null,
  unassigned: false,
};

@Injectable({ providedIn: 'root' })
export class AdminSupportStore {
  private readonly supportService = inject(AdminSupportService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);
  private readonly authFacade = inject(AuthFacade);

  private readonly _tickets = signal<AdminTicketResponseDto[]>([]);
  private readonly _pagination = signal<AdminSupportPagination>(DEFAULT_PAGINATION);
  private readonly _filters = signal<AdminSupportFilters>(DEFAULT_FILTERS);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private readonly _selectedTicket = signal<TicketResponseDto | null>(null);
  private readonly _selectedTicketLoading = signal(false);
  private readonly _actionBusy = signal(false);
  private readonly _actionError = signal<string | null>(null);

  private readonly _online = signal(false);
  private readonly _newTicketCount = signal(0);

  private joinedQueueRoom = false;
  private joinedTicketRoom: string | null = null;

  readonly tickets = this._tickets.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly selectedTicket = this._selectedTicket.asReadonly();
  readonly selectedTicketLoading = this._selectedTicketLoading.asReadonly();
  readonly actionBusy = this._actionBusy.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly online = this._online.asReadonly();
  readonly newTicketCount = this._newTicketCount.asReadonly();

  readonly currentAgentId = computed(() => this.authFacade.user()?.id ?? '');

  async loadTickets(page = 1): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    const filters = this._filters();

    try {
      const result = await this.supportService.getTickets({
        page,
        limit: this._pagination().limit,
        search: filters.search || undefined,
        status: filters.status ?? undefined,
        category: filters.category ?? undefined,
        priority: filters.priority ?? undefined,
        unassigned: filters.unassigned || undefined,
      });

      this._tickets.set(result.items);
      this._pagination.set({ page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
      this._newTicketCount.set(0);
    } catch {
      this._error.set('Unable to load tickets. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  setSearch(search: string): void {
    this._filters.update((filters) => ({ ...filters, search }));
    void this.loadTickets(1);
  }

  setStatusFilter(status: AdminTicketStatusFilter | null): void {
    this._filters.update((filters) => ({ ...filters, status }));
    void this.loadTickets(1);
  }

  setCategoryFilter(category: AdminTicketCategoryFilter | null): void {
    this._filters.update((filters) => ({ ...filters, category }));
    void this.loadTickets(1);
  }

  setPriorityFilter(priority: AdminTicketPriorityFilter | null): void {
    this._filters.update((filters) => ({ ...filters, priority }));
    void this.loadTickets(1);
  }

  setUnassignedOnly(unassigned: boolean): void {
    this._filters.update((filters) => ({ ...filters, unassigned }));
    void this.loadTickets(1);
  }

  setPage(page: number): void {
    void this.loadTickets(page);
  }

  async selectTicket(id: string): Promise<void> {
    this._selectedTicketLoading.set(true);

    try {
      this._selectedTicket.set(await this.supportService.getTicketById(id));
      void this.joinTicketRoom(id);
    } finally {
      this._selectedTicketLoading.set(false);
    }
  }

  closeSelectedTicket(): void {
    this._selectedTicket.set(null);
  }

  async assignToMe(ticketId: string): Promise<void> {
    await this.runAction(async () => {
      await this.supportService.assignTicket(ticketId, this.currentAgentId());
      await this.refreshTicketAndList(ticketId);
    });
  }

  async updateStatus(ticketId: string, status: AdminTicketStatusFilter): Promise<void> {
    await this.runAction(async () => {
      await this.supportService.updateStatus(ticketId, status);
      await this.refreshTicketAndList(ticketId);
    });
  }

  async updatePriority(ticketId: string, priority: AdminTicketPriorityFilter): Promise<void> {
    await this.runAction(async () => {
      await this.supportService.updatePriority(ticketId, priority);
      await this.refreshTicketAndList(ticketId);
    });
  }

  async postMessage(ticketId: string, message: string): Promise<void> {
    await this.runAction(async () => {
      this._selectedTicket.set(await this.supportService.postMessage(ticketId, message));
    });
  }

  private async runAction(action: () => Promise<void>): Promise<void> {
    this._actionBusy.set(true);
    this._actionError.set(null);

    try {
      await action();
    } catch {
      this._actionError.set('Action failed. Please try again.');
    } finally {
      this._actionBusy.set(false);
    }
  }

  private async refreshTicketAndList(ticketId: string): Promise<void> {
    this._selectedTicket.set(await this.supportService.getTicketById(ticketId));
    void this.loadTickets(this._pagination().page);
  }

  async toggleOnline(): Promise<void> {
    if (this._online()) {
      await this.supportService.markAgentOffline();
      this._online.set(false);
    } else {
      await this.supportService.markAgentOnline();
      this._online.set(true);
      void this.joinQueueRoom();
    }
  }

  private async joinQueueRoom(): Promise<void> {
    if (this.joinedQueueRoom) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom('support-queue');

    if (!joined) {
      return;
    }

    this.joinedQueueRoom = true;

    this.realtimeSocketService.on<unknown>('ticket.created', () => {
      this._newTicketCount.update((count) => count + 1);
    });
  }

  private async joinTicketRoom(ticketId: string): Promise<void> {
    if (this.joinedTicketRoom === ticketId) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom(`ticket:${ticketId}`);

    if (!joined) {
      return;
    }

    this.joinedTicketRoom = ticketId;

    this.realtimeSocketService.on<{ ticketId: string }>('ticket.message', (payload) => {
      if (payload.ticketId !== ticketId || this._selectedTicket()?.id !== ticketId) {
        return;
      }
      void this.supportService.getTicketById(ticketId).then((ticket) => this._selectedTicket.set(ticket));
    });
  }
}
