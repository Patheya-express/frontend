import { Injectable, inject } from '@angular/core';
import {
  AuthService as GeneratedAuthService,
  type AuthUserDto,
  type LoginDto,
  type LogoutResponseDto,
  type RefreshResponseDto,
  type RegisterDto,
  type RegisterResponseDto,
} from '@patheya-express-frontend/api-sdk';

// The API gateway wraps every response in a { success, timestamp, data } envelope via a
// global interceptor that Swagger/the generated SDK types do not account for.
interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authService = inject(GeneratedAuthService);

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const response = await this.authService.authControllerRegister({ body: dto });
    return unwrap(response);
  }

  async login(dto: LoginDto): Promise<RegisterResponseDto> {
    const response = await this.authService.authControllerLogin({ body: dto });
    return unwrap(response);
  }

  async getProfile(): Promise<AuthUserDto> {
    const response = await this.authService.authControllerGetProfile();
    return unwrap(response);
  }

  async refreshToken(refreshToken: string): Promise<RefreshResponseDto> {
    const response = await this.authService.authControllerRefreshToken({ body: { refreshToken } });
    return unwrap(response);
  }

  async logout(refreshToken: string): Promise<LogoutResponseDto> {
    const response = await this.authService.authControllerLogout({ body: { refreshToken } });
    return unwrap(response);
  }
}
