import { Injectable, inject } from '@angular/core';
import {
  UsersService,
  type PaginatedUsersResponseDto,
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

export interface GetUsersQuery {
  page: number;
  limit: number;
  search?: string;
  role?: UserResponseDto['role'];
  status?: UserResponseDto['status'];
}

/** Stateless backend orchestration for the admin user management list. */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly usersService = inject(UsersService);

  async getUsers(query: GetUsersQuery): Promise<PaginatedUsersResponseDto> {
    const response = await this.usersService.usersControllerGetAllUsers(query);
    return unwrap(response);
  }

  async activateUser(id: string): Promise<UserResponseDto> {
    const response = await this.usersService.usersControllerActivateUser({ id });
    return unwrap(response);
  }

  async suspendUser(id: string): Promise<UserResponseDto> {
    const response = await this.usersService.usersControllerSuspendUser({ id });
    return unwrap(response);
  }

  async restoreUser(id: string): Promise<UserResponseDto> {
    const response = await this.usersService.usersControllerRestoreUser({ id });
    return unwrap(response);
  }
}
