import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService,
  RestaurantDocumentsService,
  RestaurantTaxProfileService,
  RestaurantBankAccountService,
  RestaurantVerificationService,
  RestaurantComplianceService,
  type RestaurantResponseDto,
  type UpdateRestaurantDto,
  type DocumentResponseDto,
  type TaxProfileResponseDto,
  type UpsertTaxProfileDto,
  type BankAccountResponseDto,
  type UpsertBankAccountDto,
  type VerificationResponseDto,
  type ComplianceResponseDto,
} from '@patheya-express-frontend/api-sdk';

export type RestaurantDocumentType = DocumentResponseDto['documentType'];

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

/** Stateless backend orchestration for the restaurant-app profile/compliance screens. Branch
 *  management now lives in its own feature lib (@patheya-express-frontend/restaurant-branches)
 *  — this stays focused on the restaurant-wide business/verification/compliance/tax/bank record. */
@Injectable({ providedIn: 'root' })
export class RestaurantProfileService {
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly documentsService = inject(RestaurantDocumentsService);
  private readonly taxProfileService = inject(RestaurantTaxProfileService);
  private readonly bankAccountService = inject(RestaurantBankAccountService);
  private readonly verificationService = inject(RestaurantVerificationService);
  private readonly complianceService = inject(RestaurantComplianceService);

  async updateProfile(
    restaurantId: string,
    dto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerUpdateRestaurant({
      id: restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async getDocuments(restaurantId: string): Promise<DocumentResponseDto[]> {
    const response = await this.documentsService.documentsControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async uploadDocument(
    restaurantId: string,
    documentType: RestaurantDocumentType,
    file: File,
    extra?: { documentNumber?: string; expiryDate?: string; branchId?: string },
  ): Promise<DocumentResponseDto> {
    const response = await this.documentsService.documentsControllerUpload({
      restaurantId,
      body: { file, documentType, ...extra },
    });
    return unwrap(response);
  }

  async removeDocument(restaurantId: string, documentId: string): Promise<void> {
    await this.documentsService.documentsControllerRemove({ restaurantId, documentId });
  }

  async getTaxProfile(restaurantId: string): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerFind({ restaurantId });
    return unwrap(response);
  }

  async upsertTaxProfile(
    restaurantId: string,
    dto: UpsertTaxProfileDto,
  ): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerUpsert({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async getBankAccount(restaurantId: string): Promise<BankAccountResponseDto> {
    const response = await this.bankAccountService.bankAccountControllerFind({ restaurantId });
    return unwrap(response);
  }

  async upsertBankAccount(
    restaurantId: string,
    dto: UpsertBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    const response = await this.bankAccountService.bankAccountControllerUpsert({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async getVerification(restaurantId: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerGetStatus({
      restaurantId,
    });
    return unwrap(response);
  }

  async submitForVerification(restaurantId: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerSubmit({
      restaurantId,
    });
    return unwrap(response);
  }

  async getCompliance(restaurantId: string): Promise<ComplianceResponseDto> {
    const response = await this.complianceService.complianceControllerGetSnapshot({
      restaurantId,
    });
    return unwrap(response);
  }
}
