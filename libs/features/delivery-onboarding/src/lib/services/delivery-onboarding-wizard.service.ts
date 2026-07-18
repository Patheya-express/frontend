import { Injectable, inject } from '@angular/core';
import {
  DeliveryOnboardingService,
  DeliveryVerificationService,
  DeliveryProfileService,
  DeliveryVehiclesService,
  DeliveryDocumentsService,
  DeliveryBankAccountService,
  type DeliveryOnboardingResponseDto,
  type SubmitDeliveryOnboardingDto,
  type DeliveryVerificationResponseDto,
  type DeliveryProfileResponseDto,
  type UpdateDeliveryProfileDto,
  type VehicleResponseDto,
  type CreateVehicleDto,
  type DeliveryDocumentResponseDto,
  type DeliveryBankAccountResponseDto,
  type UpsertDeliveryBankAccountDto,
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

export type DeliveryDocumentType = DeliveryDocumentResponseDto['documentType'];

/**
 * Orchestration-only service for the delivery onboarding wizard: every step's actual data is
 * saved through the same already-built profile/vehicles/documents/bank-account SDK services —
 * this never duplicates that logic, it only additionally calls the onboarding progress endpoints
 * (getState/completeStep/submit) around them. Unlike restaurant-onboarding, no restaurantId (or
 * any id) needs to be resolved first — every delivery endpoint is self-scoped to the caller.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryOnboardingWizardService {
  private readonly onboardingService = inject(DeliveryOnboardingService);
  private readonly verificationService = inject(DeliveryVerificationService);
  private readonly profileService = inject(DeliveryProfileService);
  private readonly vehiclesService = inject(DeliveryVehiclesService);
  private readonly documentsService = inject(DeliveryDocumentsService);
  private readonly bankAccountService = inject(DeliveryBankAccountService);

  async getState(): Promise<DeliveryOnboardingResponseDto> {
    const response = await this.onboardingService.deliveryOnboardingControllerGetState();
    return unwrap(response);
  }

  async completeStep(step: number): Promise<DeliveryOnboardingResponseDto> {
    const response = await this.onboardingService.deliveryOnboardingControllerCompleteStep({ step });
    return unwrap(response);
  }

  async submit(dto: SubmitDeliveryOnboardingDto): Promise<DeliveryOnboardingResponseDto> {
    const response = await this.onboardingService.deliveryOnboardingControllerSubmit({ body: dto });
    return unwrap(response);
  }

  async getVerification(): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.deliveryVerificationControllerGetStatus();
    return unwrap(response);
  }

  async getProfile(): Promise<DeliveryProfileResponseDto> {
    const response = await this.profileService.profileControllerGetMyProfile();
    return unwrap(response);
  }

  async updateProfile(dto: UpdateDeliveryProfileDto): Promise<DeliveryProfileResponseDto> {
    const response = await this.profileService.profileControllerUpdateMyProfile({ body: dto });
    return unwrap(response);
  }

  async getVehicles(): Promise<VehicleResponseDto[]> {
    const response = await this.vehiclesService.vehiclesControllerList();
    return unwrap(response);
  }

  async createVehicle(dto: CreateVehicleDto): Promise<VehicleResponseDto> {
    const response = await this.vehiclesService.vehiclesControllerCreate({ body: dto });
    return unwrap(response);
  }

  async getDocuments(): Promise<DeliveryDocumentResponseDto[]> {
    const response = await this.documentsService.deliveryDocumentsControllerFindAll();
    return unwrap(response);
  }

  async uploadDocument(
    documentType: DeliveryDocumentType,
    file: File,
    options?: { vehicleId?: string; previousVersionId?: string },
  ): Promise<DeliveryDocumentResponseDto> {
    const response = await this.documentsService.deliveryDocumentsControllerUpload({
      body: {
        file,
        documentType,
        vehicleId: options?.vehicleId,
        previousVersionId: options?.previousVersionId,
      },
    });
    return unwrap(response);
  }

  async getBankAccount(): Promise<DeliveryBankAccountResponseDto | null> {
    try {
      const response = await this.bankAccountService.deliveryBankAccountControllerFind();
      return unwrap(response);
    } catch {
      return null;
    }
  }

  async upsertBankAccount(dto: UpsertDeliveryBankAccountDto): Promise<DeliveryBankAccountResponseDto> {
    const response = await this.bankAccountService.deliveryBankAccountControllerUpsert({ body: dto });
    return unwrap(response);
  }
}
