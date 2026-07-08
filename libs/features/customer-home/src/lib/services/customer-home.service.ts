import { Injectable, inject } from '@angular/core';
import { CustomerService, type CustomerHomeResponseDto } from '@patheya-express-frontend/api-sdk';

export interface CustomerHomeQuery {
  lat?: number;
  lng?: number;
}

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
export class CustomerHomeService {
  private readonly customerService = inject(CustomerService);

  async getHome(query: CustomerHomeQuery = {}): Promise<CustomerHomeResponseDto> {
    const response = await this.customerService.customerHomeControllerGetHome(query);
    return unwrap(response);
  }
}
