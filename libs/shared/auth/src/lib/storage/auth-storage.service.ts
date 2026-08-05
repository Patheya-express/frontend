import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import type { AuthUserDto } from '@patheya-express-frontend/api-sdk';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

const ACCESS_TOKEN_KEY = 'patheya.auth.accessToken';
const REFRESH_TOKEN_KEY = 'patheya.auth.refreshToken';
const USER_KEY = 'patheya.auth.user';

/**
 * Web: unchanged, backed directly by `localStorage`, synchronously.
 *
 * Native: backed by `capacitor-secure-storage-plugin` (iOS Keychain / Android Keystore-backed
 * EncryptedSharedPreferences) instead of the WebView's own `localStorage` — but every native
 * bridge call is async, while `load()` is called synchronously in several places (app bootstrap,
 * the cross-tab `storage` listener, every `refreshSession()`/`logout()`). Rather than push that
 * async-ness onto every caller (a breaking change to a stable, widely-depended-on service), an
 * in-memory cache mirrors the secure store: `hydrate()` populates it once, awaited at bootstrap
 * before anything calls `load()`; `save()`/`clear()` update it synchronously and persist to the
 * secure store in the background. A process kill between `save()` and the background write
 * completing could theoretically lose the update, but that's the same window every fire-and-forget
 * native persistence call has — not something a synchronous public API can avoid without an
 * async rewrite of `AuthStore` itself, which is out of scope here.
 */
@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  private readonly isNative = Capacitor.isNativePlatform();
  private nativeCache: StoredSession | null = null;
  private nativeHydrated = false;

  /** No-op on web. Native: reads the secure store into the in-memory cache once. Must be awaited
   *  before the first `load()` call (see `AuthFacade.hydrateNativeSession()`). */
  async hydrate(): Promise<void> {
    if (!this.isNative || this.nativeHydrated) {
      return;
    }

    this.nativeCache = await this.readFromSecureStorage();
    this.nativeHydrated = true;
  }

  load(): StoredSession | null {
    return this.isNative ? this.nativeCache : this.loadFromLocalStorage();
  }

  save(session: StoredSession): void {
    if (this.isNative) {
      this.nativeCache = session;
      void this.writeToSecureStorage(session);
      return;
    }

    this.saveToLocalStorage(session);
  }

  clear(): void {
    if (this.isNative) {
      this.nativeCache = null;
      void this.clearSecureStorage();
      return;
    }

    this.clearLocalStorage();
  }

  private loadFromLocalStorage(): StoredSession | null {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!accessToken || !refreshToken || !rawUser) {
      return null;
    }

    try {
      const user = JSON.parse(rawUser) as AuthUserDto;
      return { accessToken, refreshToken, user };
    } catch {
      return null;
    }
  }

  private saveToLocalStorage(session: StoredSession): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }

  private clearLocalStorage(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private async readFromSecureStorage(): Promise<StoredSession | null> {
    try {
      const [accessToken, refreshToken, rawUser] = await Promise.all([
        this.secureGet(ACCESS_TOKEN_KEY),
        this.secureGet(REFRESH_TOKEN_KEY),
        this.secureGet(USER_KEY),
      ]);

      if (!accessToken || !refreshToken || !rawUser) {
        return null;
      }

      return { accessToken, refreshToken, user: JSON.parse(rawUser) as AuthUserDto };
    } catch {
      return null;
    }
  }

  private async writeToSecureStorage(session: StoredSession): Promise<void> {
    try {
      await Promise.all([
        SecureStoragePlugin.set({ key: ACCESS_TOKEN_KEY, value: session.accessToken }),
        SecureStoragePlugin.set({ key: REFRESH_TOKEN_KEY, value: session.refreshToken }),
        SecureStoragePlugin.set({ key: USER_KEY, value: JSON.stringify(session.user) }),
      ]);
    } catch {
      // Best-effort: the in-memory cache (already updated synchronously in save()) keeps the
      // current session usable for the rest of this process lifetime even if the persisted write
      // failed; the next successful save() retries the write.
    }
  }

  private async clearSecureStorage(): Promise<void> {
    await Promise.all([
      SecureStoragePlugin.remove({ key: ACCESS_TOKEN_KEY }).catch(() => undefined),
      SecureStoragePlugin.remove({ key: REFRESH_TOKEN_KEY }).catch(() => undefined),
      SecureStoragePlugin.remove({ key: USER_KEY }).catch(() => undefined),
    ]);
  }

  private async secureGet(key: string): Promise<string | null> {
    try {
      const result = await SecureStoragePlugin.get({ key });
      return result.value;
    } catch {
      return null;
    }
  }
}
