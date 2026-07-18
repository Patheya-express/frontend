import { Injectable, inject, signal } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { AuthFacade } from '@patheya-express-frontend/auth';
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

  readonly connected = signal(false);

  private connect(): Socket {
    if (this.socket) {
      return this.socket;
    }

    const token = this.authFacade.getAccessToken();

    const socket = io(this.environment.socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => this.connected.set(true));
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
  }
}
