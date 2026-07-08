import { Injectable, inject } from '@angular/core';
import {
  UsersService,
  type ChangePasswordDto,
  type NotificationPreferencesResponseDto,
  type SuccessResponseDto,
  type UpdatePreferencesDto,
  type UpdateProfileDto,
  type UserResponseDto,
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
export class CustomerProfileService {
  private readonly usersService = inject(UsersService);

  async getProfile(): Promise<UserResponseDto> {
    const response = await this.usersService.usersControllerGetProfile();
    return unwrap(response);
  }

  async updateProfile(dto: UpdateProfileDto): Promise<UserResponseDto> {
    const response = await this.usersService.usersControllerUpdateProfile({ body: dto });
    return unwrap(response);
  }

  async changePassword(dto: ChangePasswordDto): Promise<SuccessResponseDto> {
    const response = await this.usersService.usersControllerChangePassword({ body: dto });
    return unwrap(response);
  }

  async uploadAvatar(file: File): Promise<UserResponseDto> {
    const response = await this.usersService.usersControllerUploadAvatar({ body: { file } });
    return unwrap(response);
  }

  async getPreferences(): Promise<NotificationPreferencesResponseDto> {
    const response = await this.usersService.usersControllerGetPreferences();
    return unwrap(response);
  }

  async updatePreferences(dto: UpdatePreferencesDto): Promise<NotificationPreferencesResponseDto> {
    const response = await this.usersService.usersControllerUpdatePreferences({ body: dto });
    return unwrap(response);
  }

  async deleteAccount(): Promise<SuccessResponseDto> {
    const response = await this.usersService.usersControllerDeleteAccount();
    return unwrap(response);
  }
}
