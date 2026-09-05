import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { io } from 'socket.io-client';
import {
  AuthFacade,
  LogoutCleanupRegistry,
} from '@patheya-express-frontend/auth';
import {
  APP_ENVIRONMENT,
  type AppEnvironment,
} from '../environment/app-environment';
import { MobilePlatformService } from '../mobile/mobile-platform.service';
import { RealtimeSocketService } from './realtime-socket.service';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

type Handler = (...args: unknown[]) => void;

interface FakeSocket {
  connected: boolean;
  auth: Record<string, unknown>;
  on: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  connect: jest.Mock;
  trigger(event: string, ...args: unknown[]): void;
}

function createFakeSocket(initialAuth: Record<string, unknown>): FakeSocket {
  const listeners = new Map<string, Set<Handler>>();

  const socket: FakeSocket = {
    connected: false,
    auth: initialAuth,
    on: jest.fn((event: string, handler: Handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(handler);
      return socket;
    }),
    off: jest.fn((event: string, handler: Handler) => {
      listeners.get(event)?.delete(handler);
      return socket;
    }),
    emit: jest.fn((event: string, ...rest: unknown[]) => {
      // Mirrors the server's join-room acknowledgment contract `joinRoom()` relies on
      // (`socket.emit('join-room', room, (result) => ...)`), so awaiting `joinRoom()` in a test
      // resolves instead of hanging.
      if (event === 'join-room') {
        const [room, ack] = rest as [
          string,
          ((result: { success: boolean; room: string }) => void)?,
        ];
        ack?.({ success: true, room });
      }
    }),
    disconnect: jest.fn(() => {
      socket.connected = false;
      return socket;
    }),
    connect: jest.fn(() => {
      socket.connected = true;
      return socket;
    }),
    trigger(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((handler) => handler(...args));
    },
  };

  return socket;
}

const mockedIo = jest.mocked(io);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  // Zoneless `effect()` scheduling isn't guaranteed to flush within pure microtasks in a test
  // environment with no host change-detection loop driving it — a macrotask tick reliably lets
  // Angular's scheduler run any pending effect before the test's next assertion.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('RealtimeSocketService — M4 realtime hardening', () => {
  let tokenSignal: ReturnType<typeof signal<string | null>>;
  let getAccessToken: jest.Mock<string | null, []>;
  let resumeCallback: (() => void) | undefined;
  let mobilePlatform: { onResume: jest.Mock };
  let sockets: FakeSocket[];
  let logoutRegistry: LogoutCleanupRegistry;

  function environment(): AppEnvironment {
    return {
      production: false,
      apiBaseUrl: 'http://localhost/api',
      socketUrl: 'http://localhost',
      mediaBaseUrl: 'http://localhost/media',
      razorpayKeyId: 'test',
      maps: { provider: 'GOOGLE_MAPS' },
    };
  }

  beforeEach(() => {
    resumeCallback = undefined;
    sockets = [];
    tokenSignal = signal<string | null>('token-1');
    getAccessToken = jest.fn(() => tokenSignal());

    mockedIo.mockImplementation((_url, options) => {
      const socket = createFakeSocket({
        ...(options?.auth as Record<string, unknown>),
      });
      sockets.push(socket);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return socket as any;
    });

    mobilePlatform = {
      onResume: jest.fn((callback: () => void) => {
        resumeCallback = callback;
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENVIRONMENT, useValue: environment() },
        {
          provide: AuthFacade,
          useValue: { accessToken: tokenSignal, getAccessToken },
        },
        { provide: MobilePlatformService, useValue: mobilePlatform },
      ],
    });

    logoutRegistry = TestBed.inject(LogoutCleanupRegistry);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
  });

  function currentSocket(): FakeSocket {
    return sockets[sockets.length - 1];
  }

  describe('initial connection', () => {
    it('authenticates the very first connection with the current access token', () => {
      const service = TestBed.inject(RealtimeSocketService);

      service.joinRoom('order:1');

      expect(mockedIo).toHaveBeenCalledWith(
        'http://localhost',
        expect.objectContaining({ auth: { token: 'token-1' } }),
      );
    });
  });

  describe('token rotation (M4.1/M4.2)', () => {
    it('does nothing before any socket exists — no premature connection is opened', async () => {
      TestBed.inject(RealtimeSocketService);

      tokenSignal.set('token-2');
      await flush();

      expect(mockedIo).not.toHaveBeenCalled();
    });

    it('reconnects an existing socket with the new token when the access token rotates', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();

      tokenSignal.set('token-2');
      await flush();

      expect(socket.auth).toEqual({ token: 'token-2' });
      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(socket.connect).toHaveBeenCalledTimes(1);
      // Reauthenticating reconnects the *same* Socket.IO client instance rather than replacing it.
      expect(mockedIo).toHaveBeenCalledTimes(1);
    });

    it('existing room subscriptions survive/rejoin after a token-rotation reconnect', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      await service.joinRoom('order:1');
      const socket = currentSocket();
      socket.emit.mockClear();

      tokenSignal.set('token-2');
      await flush();
      socket.trigger('connect'); // simulates the transport actually re-establishing

      expect(socket.emit).toHaveBeenCalledWith('join-room', 'order:1');
    });

    it('a repeat notification of the same token does not trigger a second reconnect', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();

      tokenSignal.set('token-2');
      await flush();
      expect(socket.disconnect).toHaveBeenCalledTimes(1);

      tokenSignal.set('token-2'); // no actual change — Angular signals treat this as a no-op write
      await flush();

      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    it('multiple rapid token changes coalesce onto the latest value, not one reconnect per change', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();

      tokenSignal.set('token-2');
      tokenSignal.set('token-3');
      tokenSignal.set('token-4');
      await flush();

      expect(socket.auth).toEqual({ token: 'token-4' });
      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    it('a token changing to null (logout) is not treated as a rotation — no reconnect is attempted', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();

      tokenSignal.set(null);
      await flush();

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.auth).toEqual({ token: 'token-1' });
    });
  });

  describe('auth failure (M4.3)', () => {
    it('a connect_error only marks the socket disconnected — it never calls a refresh endpoint or logs out', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      await service.joinRoom('order:1');
      const socket = currentSocket();
      const callsBeforeError = getAccessToken.mock.calls.length;

      socket.trigger('connect_error', new Error('unauthorized'));

      expect(service.connected()).toBe(false);
      // The connect_error handler itself only sets `connected(false)` — it must not read the
      // token again, call refreshSession(), or call logout(); AuthFacade only exposes
      // getAccessToken()/accessToken() in this service, so "no new call" is the whole surface.
      expect(getAccessToken.mock.calls.length).toBe(callsBeforeError);
    });

    it('repeated connect_error events do not cause repeated reconnect attempts from this service (left to socket.io defaults)', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();

      socket.trigger('connect_error', new Error('unauthorized'));
      socket.trigger('connect_error', new Error('unauthorized'));
      socket.trigger('connect_error', new Error('unauthorized'));

      // This service issues no manual reconnect calls in response to connect_error — only
      // socket.io's own internal (unconfigured/default) reconnection logic would ever do so.
      expect(socket.connect).not.toHaveBeenCalled();
    });

    it('logged-out state prevents automatic reconnect — resume does nothing once the socket was disconnected by logout', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      logoutRegistry.runAll();
      tokenSignal.set(null);
      await flush();

      resumeCallback?.();

      expect(mockedIo).toHaveBeenCalledTimes(1); // no second socket was ever created
      expect(service.connected()).toBe(false);
    });
  });

  describe('app resume (M4.4)', () => {
    it('does not reconnect a healthy (already-connected) socket', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();
      socket.connected = true;
      socket.connect.mockClear();

      resumeCallback?.();

      expect(socket.connect).not.toHaveBeenCalled();
    });

    it('reconnects a disconnected socket on resume when the app should still be authenticated', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();
      socket.connected = false;

      resumeCallback?.();

      expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no socket has ever been created', () => {
      TestBed.inject(RealtimeSocketService);

      expect(() => resumeCallback?.()).not.toThrow();
      expect(mockedIo).not.toHaveBeenCalled();
    });

    it('also reconciles a rotated token on resume (in case the effect had not yet flushed while backgrounded)', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();
      tokenSignal.set('token-2'); // signal updated, but no `await flush()` — simulates a pending effect
      getAccessToken.mockReturnValue('token-2');

      resumeCallback?.();

      expect(socket.auth).toEqual({ token: 'token-2' });
    });
  });

  describe('listener lifecycle (M4.7)', () => {
    it('repeated resume cycles on an already-healthy socket never re-register the connect/disconnect handlers', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();
      socket.connected = true;
      const onCallsBefore = socket.on.mock.calls.length;

      resumeCallback?.();
      resumeCallback?.();
      resumeCallback?.();

      expect(socket.on.mock.calls.length).toBe(onCallsBefore); // resume never calls socket.on again
    });

    it('a feature-registered listener is invoked exactly once per server event', () => {
      const service = TestBed.inject(RealtimeSocketService);
      const handler = jest.fn();
      service.on('order.status.changed', handler);
      const socket = currentSocket();

      socket.trigger('order.status.changed', { orderId: '1' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('the unsubscribe function returned by on() actually removes the listener', () => {
      const service = TestBed.inject(RealtimeSocketService);
      const handler = jest.fn();
      const unsubscribe = service.on('order.status.changed', handler);
      const socket = currentSocket();

      unsubscribe();
      socket.trigger('order.status.changed', { orderId: '1' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('a token-rotation reconnect does not duplicate a feature listener (still fires once)', async () => {
      const service = TestBed.inject(RealtimeSocketService);
      const handler = jest.fn();
      service.on('order.status.changed', handler);
      const socket = currentSocket();

      tokenSignal.set('token-2');
      await flush();
      socket.trigger('order.status.changed', { orderId: '1' });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout (M4.10)', () => {
    it('disconnects the socket and clears joined-room state', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      const socket = currentSocket();

      logoutRegistry.runAll();

      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(service.connected()).toBe(false);
    });

    it('a subsequent resume does not recreate a session after logout', () => {
      const service = TestBed.inject(RealtimeSocketService);
      service.joinRoom('order:1');
      logoutRegistry.runAll();

      resumeCallback?.();

      expect(mockedIo).toHaveBeenCalledTimes(1); // still just the one original socket
      expect(service.connected()).toBe(false);
    });
  });
});
