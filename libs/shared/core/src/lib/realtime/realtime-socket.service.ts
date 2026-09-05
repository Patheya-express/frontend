import { Injectable, effect, inject, signal } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import {
  AuthFacade,
  LogoutCleanupRegistry,
} from '@patheya-express-frontend/auth';
import { APP_ENVIRONMENT } from '../environment/app-environment';
import { MobilePlatformService } from '../mobile/mobile-platform.service';

export interface JoinRoomResult {
  success: boolean;
  room?: string;
  error?: string;
}

/**
 * A single shared, authenticated Socket.IO connection for the whole app. The connection is
 * opened lazily on first use and carries the current access token in the handshake — the
 * server rejects unauthenticated sockets and authorizes every room join against the connecting
 * user's identity, so callers only need to know which room name to join.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSocketService {
  private readonly environment = inject(APP_ENVIRONMENT);
  private readonly authFacade = inject(AuthFacade);

  private socket: Socket | null = null;
  /** Rooms successfully joined via `joinRoom()` — replayed on every `connect` event (including
   *  socket.io's own auto-reconnect after a network blip, and M4's token-rotation reconnect
   *  below), since the server has no memory of a new connection's prior room membership. Without
   *  this, a reconnect silently stops delivering room-scoped events (e.g. order status/location)
   *  while `connected` still reads `true`, so consumers relying on it to decide "is realtime
   *  working" have no signal anything is wrong. */
  private readonly joinedRooms = new Set<string>();

  /** M4: the token the current socket connection actually authenticated with — compared against
   *  `authFacade.accessToken()` to decide whether a reauth-reconnect is needed. Tracking this
   *  (rather than re-reading `socket.auth.token` back) is what makes `reauthenticate()` an
   *  idempotent no-op for a token it has already applied, which is the entire coalescing
   *  mechanism for M4.2 — no timers, no second single-flight primitive. */
  private lastAuthenticatedToken: string | null = null;

  readonly connected = signal(false);

  constructor() {
    inject(LogoutCleanupRegistry).register(() => this.disconnect());

    // M4.1/M4.2 — AuthStore.accessToken is the single source of truth; this never calls the
    // refresh endpoint or duplicates authInterceptor's single-flight refresh, it only reacts
    // once that refresh (or a login, or a logout) has already updated the signal. Angular
    // coalesces synchronous signal writes into one effect run with the latest value, and
    // `reauthenticate()`'s own `lastAuthenticatedToken` check makes a repeat notification of the
    // same token a no-op — together these are what prevent a disconnect/connect storm from
    // multiple rapid token-change notifications.
    effect(() => this.reauthenticate(this.authFacade.accessToken()));

    // M4.4 — the audit's "app resume does not explicitly perform realtime resynchronization"
    // finding. Reuses the existing lifecycle abstraction (no second listener mechanism); this is
    // one more independent consumer of it, the same way DeliveryDashboardStore and
    // DeliveryAssignmentsStore each already register their own onResume() callback for their own
    // unrelated purposes.
    inject(MobilePlatformService).onResume(() => this.resyncOnResume());
  }

  private connect(): Socket {
    if (this.socket) {
      return this.socket;
    }

    const token = this.authFacade.getAccessToken();
    this.lastAuthenticatedToken = token;

    const socket = io(this.environment.socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      this.connected.set(true);
      for (const room of this.joinedRooms) {
        socket.emit('join-room', room);
      }
    });
    socket.on('disconnect', () => this.connected.set(false));
    socket.on('connect_error', () => this.connected.set(false));

    this.socket = socket;

    return socket;
  }

  /**
   * M4.1/M4.3 — the only place a new access token reaches the socket. A `null` token (logout) is
   * deliberately ignored here: `LogoutCleanupRegistry`'s existing `disconnect()` registration
   * owns that transition exclusively (see its comment on `constructor()`), so this never races it
   * or attempts to open a connection for a logged-out user. Likewise a no-op when no socket has
   * ever been created (`connect()` will pick up the current token itself the first time one
   * actually is), and when the token hasn't changed since the last (re)connect — that equality
   * check is the entire "don't reconnect repeatedly for the same token" guarantee.
   *
   * Socket.IO only reads `auth` at connection time, so an already-open connection isn't
   * retroactively re-authenticated — updating `socket.auth` and forcing a disconnect+connect on
   * the *same* Socket instance is the documented way to rotate credentials on a live client.
   * Existing `.on()` listeners registered by feature stores (order-details, restaurant-orders,
   * etc.) stay attached across this — they belong to the Socket object, not to any one physical
   * connection — and the existing `connect` handler above replays `joinedRooms` exactly as it
   * would for socket.io's own automatic reconnect, so room membership survives unchanged.
   */
  private reauthenticate(token: string | null): void {
    if (!token || !this.socket || token === this.lastAuthenticatedToken) {
      return;
    }

    this.lastAuthenticatedToken = token;
    this.socket.auth = { token };
    this.socket.disconnect().connect();
  }

  /**
   * M4.4 — app resume. First reconciles authentication (a no-op if the token hasn't actually
   * changed while backgrounded), then restores the connection only if it should be up but isn't.
   * Deliberately does *not* force a reconnect when the socket is already connected — an
   * already-healthy socket has nothing to resynchronize at the transport level, and forcing one
   * would just be a disconnect/reconnect with no purpose. Domain-level resynchronization (e.g.
   * delivery assignments) is a separate, existing concern this method knows nothing about — see
   * `DeliveryAssignmentsStore.revalidateIfNotFresh()` (M3), which already has its own
   * independent `onResume()` registration for exactly that.
   */
  private resyncOnResume(): void {
    this.reauthenticate(this.authFacade.getAccessToken());

    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  /** Resolves true if the server authorized the join; false if it rejected it (or the socket isn't connected/authenticated). */
  joinRoom(room: string): Promise<boolean> {
    const socket = this.connect();

    return new Promise((resolve) => {
      socket.emit('join-room', room, (result: JoinRoomResult) => {
        if (result?.success === true) {
          this.joinedRooms.add(room);
        }
        resolve(result?.success === true);
      });
    });
  }

  /** Subscribes to a server-pushed event; returns an unsubscribe function. */
  on<T>(event: string, handler: (payload: T) => void): () => void {
    const socket = this.connect();

    socket.on(event, handler);

    return () => socket.off(event, handler);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
    this.joinedRooms.clear();
  }
}
