import { Injectable, computed, signal } from '@angular/core';

export type MobileNetworkState = 'online' | 'offline';

/**
 * Wraps the browser's `online`/`offline` events behind a signal — used by `OfflineBannerComponent`
 * and `NetworkStatusComponent`. Deliberately built on `navigator.onLine`/`window` events rather
 * than a `@capacitor/network` plugin: Phase 1 didn't install one, and the web `online`/`offline`
 * events already fire correctly inside a Capacitor WebView on both Android and iOS, so no native
 * dependency is needed just for this signal.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly stateSignal = signal<MobileNetworkState>(this.readCurrentState());

  /** Reactive connectivity state — `'online'` until the browser fires a real `offline` event. */
  readonly state = this.stateSignal.asReadonly();
  readonly isOffline = computed(() => this.stateSignal() === 'offline');
  readonly isOnline = computed(() => this.stateSignal() === 'online');

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => this.stateSignal.set('online'));
    window.addEventListener('offline', () => this.stateSignal.set('offline'));
  }

  private readCurrentState(): MobileNetworkState {
    if (typeof navigator === 'undefined' || navigator.onLine === undefined) {
      return 'online';
    }

    return navigator.onLine ? 'online' : 'offline';
  }
}
