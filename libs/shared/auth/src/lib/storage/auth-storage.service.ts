import { Injectable } from '@angular/core';
import type { AuthUserDto } from '@patheya-express-frontend/api-sdk';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

const ACCESS_TOKEN_KEY = 'patheya.auth.accessToken';
const REFRESH_TOKEN_KEY = 'patheya.auth.refreshToken';
const USER_KEY = 'patheya.auth.user';

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  load(): StoredSession | null {
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

  save(session: StoredSession): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }

  updateAccessToken(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
