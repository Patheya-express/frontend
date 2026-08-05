import { Injectable, inject, signal } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { AuthFacade, LogoutCleanupRegistry } from '@patheya-express-frontend/auth';
import { APP_ENVIRONMENT } from '../environment/app-environment';

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
   *  socket.io's own auto-reconnect after a network blip), since the server has no memory of a
   *  new connection's prior room membership. Without this, a reconnect silently stops delivering
   *  room-scoped events (e.g. order status/location) while `connected` still reads `true`, so
   *  consumers relying on it to decide "is realtime working" have no signal anything is wrong. */
  private readonly joinedRooms = new Set<string>();

  readonly connected = signal(false);

  constructor() {
    inject(LogoutCleanupRegistry).register(() => this.disconnect());
  }

  private connect(): Socket {
    if (this.socket) {
      return this.socket;
    }

    const token = this.authFacade.getAccessToken();

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
