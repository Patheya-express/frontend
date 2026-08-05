import { Injectable, inject, signal } from '@angular/core';
import type { CreateTicketDto, FaqResponseDto, TicketResponseDto, TicketSummaryDto } from '@patheya-express-frontend/api-sdk';
import { RealtimeSocketService } from '@patheya-express-frontend/core';
import { CustomerSupportService, type GetMyTicketsParams, type TicketCategory, type TicketStatus } from '../services/customer-support.service';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class CustomerSupportStore {
  private readonly supportService = inject(CustomerSupportService);
  private readonly realtimeSocketService = inject(RealtimeSocketService);

  private readonly _tickets = signal<TicketSummaryDto[]>([]);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _totalPages = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _statusFilter = signal<TicketStatus | undefined>(undefined);
  private readonly _categoryFilter = signal<TicketCategory | undefined>(undefined);

  private readonly _selectedTicket = signal<TicketResponseDto | null>(null);
  private readonly _selectedTicketLoading = signal(false);
  private readonly _selectedTicketError = signal<string | null>(null);
  private readonly _sendingMessage = signal(false);

  private readonly _creating = signal(false);
  private readonly _createError = signal<string | null>(null);

  private readonly _faqs = signal<FaqResponseDto[]>([]);
  private readonly _faqsLoading = signal(false);
  private readonly _faqsError = signal<string | null>(null);

  private joinedTicketRoom: string | null = null;
  private unsubscribeTicketStatus: (() => void) | null = null;
  private unsubscribeTicketMessage: (() => void) | null = null;
  private loadTicketsRequestId = 0;

  readonly tickets = this._tickets.asReadonly();
  readonly total = this._total.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly statusFilter = this._statusFilter.asReadonly();
  readonly categoryFilter = this._categoryFilter.asReadonly();

  readonly selectedTicket = this._selectedTicket.asReadonly();
  readonly selectedTicketLoading = this._selectedTicketLoading.asReadonly();
  readonly selectedTicketError = this._selectedTicketError.asReadonly();
  readonly sendingMessage = this._sendingMessage.asReadonly();

  readonly creating = this._creating.asReadonly();
  readonly createError = this._createError.asReadonly();

  readonly faqs = this._faqs.asReadonly();
  readonly faqsLoading = this._faqsLoading.asReadonly();
  readonly faqsError = this._faqsError.asReadonly();

  /**
   * `setStatusFilter`/`setCategoryFilter` each call this independently, so rapid filter changes
   * can have two requests in flight at once — a request id guards against an older one's response
   * overwriting a newer one's if it happens to resolve last.
   */
  async loadTickets(page = 1): Promise<void> {
    const requestId = ++this.loadTicketsRequestId;
    this._loading.set(true);
    this._error.set(null);

    const params: GetMyTicketsParams = {
      page,
      limit: PAGE_SIZE,
      status: this._statusFilter(),
      category: this._categoryFilter(),
    };

    try {
      const result = await this.supportService.getMyTickets(params);

      if (requestId !== this.loadTicketsRequestId) {
        return;
      }

      this._tickets.set(result.items);
      this._total.set(result.total);
      this._page.set(result.page);
      this._totalPages.set(result.totalPages);
    } catch {
      if (requestId !== this.loadTicketsRequestId) {
        return;
      }

      this._error.set('Unable to load your support tickets. Please try again.');
    } finally {
      if (requestId === this.loadTicketsRequestId) {
        this._loading.set(false);
      }
    }
  }

  setStatusFilter(status: TicketStatus | undefined): void {
    this._statusFilter.set(status);
    void this.loadTickets(1);
  }

  setCategoryFilter(category: TicketCategory | undefined): void {
    this._categoryFilter.set(category);
    void this.loadTickets(1);
  }

  async createTicket(dto: CreateTicketDto): Promise<TicketResponseDto | null> {
    if (this._creating()) {
      return null;
    }

    this._creating.set(true);
    this._createError.set(null);

    try {
      return await this.supportService.createTicket(dto);
    } catch {
      this._createError.set('Unable to create your ticket. Please try again.');
      return null;
    } finally {
      this._creating.set(false);
    }
  }

  async loadTicketById(id: string): Promise<void> {
    this._selectedTicketLoading.set(true);
    this._selectedTicketError.set(null);

    try {
      this._selectedTicket.set(await this.supportService.getMyTicketById(id));
      void this.joinTicketRoom(id);
    } catch {
      this._selectedTicketError.set('This ticket could not be loaded.');
    } finally {
      this._selectedTicketLoading.set(false);
    }
  }

  private async joinTicketRoom(ticketId: string): Promise<void> {
    if (this.joinedTicketRoom === ticketId) {
      return;
    }

    const joined = await this.realtimeSocketService.joinRoom(`ticket:${ticketId}`);

    if (!joined) {
      return;
    }

    // Switching to a different ticket without leaving the page (list → ticket A → ticket B)
    // must drop the previous ticket's listeners first, or they accumulate on the shared,
    // app-lifetime socket for the rest of the session.
    this.unsubscribeStatus();

    this.joinedTicketRoom = ticketId;

    this.unsubscribeTicketStatus = this.realtimeSocketService.on<{ ticketId: string; status: string }>(
      'ticket.status.changed',
      (payload) => {
        if (payload.ticketId !== ticketId) {
          return;
        }
        void this.loadTicketById(ticketId);
      },
    );

    this.unsubscribeTicketMessage = this.realtimeSocketService.on<{ ticketId: string }>(
      'ticket.message',
      (payload) => {
        if (payload.ticketId !== ticketId) {
          return;
        }
        void this.refreshSelectedTicket();
      },
    );
  }

  private unsubscribeStatus(): void {
    this.unsubscribeTicketStatus?.();
    this.unsubscribeTicketMessage?.();
    this.unsubscribeTicketStatus = null;
    this.unsubscribeTicketMessage = null;
  }

  private async refreshSelectedTicket(): Promise<void> {
    const current = this._selectedTicket();
    if (!current) {
      return;
    }
    this._selectedTicket.set(await this.supportService.getMyTicketById(current.id));
  }

  async postMessage(id: string, message: string): Promise<void> {
    this._sendingMessage.set(true);

    try {
      this._selectedTicket.set(await this.supportService.postMessage(id, message));
    } finally {
      this._sendingMessage.set(false);
    }
  }

  async uploadAttachment(id: string, file: File): Promise<void> {
    this._selectedTicket.set(await this.supportService.uploadAttachment(id, file));
  }

  async closeTicket(id: string): Promise<void> {
    this._selectedTicket.set(await this.supportService.closeTicket(id));
  }

  async loadFaqs(category?: string): Promise<void> {
    this._faqsLoading.set(true);
    this._faqsError.set(null);

    try {
      this._faqs.set(await this.supportService.getFaqs(category));
    } catch {
      // Was previously uncaught. The template only branched on faqsLoading()/faqs().length,
      // so a failed fetch rendered "No FAQs yet" — a network failure misrepresented as "there is
      // no help content", discouraging a retry that would likely have fixed it.
      this._faqsError.set('Unable to load help articles.');
    } finally {
      this._faqsLoading.set(false);
    }
  }
}
