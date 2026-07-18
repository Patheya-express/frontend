import { Injectable, inject } from '@angular/core';
import {
  RestaurantsService,
  RestaurantVerificationService,
  RestaurantDocumentsService,
  RestaurantTaxProfileService,
  RestaurantBankAccountService,
  RestaurantBranchesService,
  RestaurantStaffService,
  RestaurantMediaService,
  RestaurantComplianceService,
  RestaurantSettingsService,
  RestaurantOnboardingService,
  type PaginatedRestaurantsResponseDto,
  type VerificationResponseDto,
  type DocumentResponseDto,
  type TaxProfileResponseDto,
  type BankAccountResponseDto,
  type BranchResponseDto,
  type StaffResponseDto,
  type MediaResponseDto,
  type ComplianceResponseDto,
  type RestaurantSettingsResponseDto,
  type OnboardingResponseDto,
  type OnboardingChangeItemDto,
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

export interface AdminRestaurantVerificationListParams {
  page: number;
  limit: number;
  search?: string;
}

/** Stateless backend orchestration for the admin restaurant-verification queue. */
@Injectable({ providedIn: 'root' })
export class AdminRestaurantVerificationService {
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly verificationService = inject(RestaurantVerificationService);
  private readonly documentsService = inject(RestaurantDocumentsService);
  private readonly taxProfileService = inject(RestaurantTaxProfileService);
  private readonly bankAccountService = inject(RestaurantBankAccountService);
  private readonly branchesService = inject(RestaurantBranchesService);
  private readonly staffService = inject(RestaurantStaffService);
  private readonly mediaService = inject(RestaurantMediaService);
  private readonly complianceService = inject(RestaurantComplianceService);
  private readonly settingsService = inject(RestaurantSettingsService);
  private readonly onboardingService = inject(RestaurantOnboardingService);

  async getRestaurants(
    params: AdminRestaurantVerificationListParams,
  ): Promise<PaginatedRestaurantsResponseDto> {
    const response = await this.restaurantsService.restaurantsControllerGetAllForAdmin(params);
    return unwrap(response);
  }

  async getVerification(restaurantId: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerGetStatus({
      restaurantId,
    });
    return unwrap(response);
  }

  async advanceVerification(restaurantId: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerAdvance({
      restaurantId,
    });
    return unwrap(response);
  }

  async rejectVerification(restaurantId: string, rejectedReason: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerReject({
      restaurantId,
      body: { rejectedReason },
    });
    return unwrap(response);
  }

  async suspendVerification(restaurantId: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerSuspend({
      restaurantId,
    });
    return unwrap(response);
  }

  async reinstateVerification(restaurantId: string): Promise<VerificationResponseDto> {
    const response = await this.verificationService.verificationControllerReinstate({
      restaurantId,
    });
    return unwrap(response);
  }

  async getDocuments(restaurantId: string): Promise<DocumentResponseDto[]> {
    const response = await this.documentsService.documentsControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async verifyDocument(restaurantId: string, documentId: string): Promise<DocumentResponseDto> {
    const response = await this.documentsService.documentsControllerVerify({
      restaurantId,
      documentId,
    });
    return unwrap(response);
  }

  async rejectDocument(
    restaurantId: string,
    documentId: string,
    rejectedReason: string,
  ): Promise<DocumentResponseDto> {
    const response = await this.documentsService.documentsControllerReject({
      restaurantId,
      documentId,
      body: { rejectedReason },
    });
    return unwrap(response);
  }

  async getTaxProfile(restaurantId: string): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerFind({ restaurantId });
    return unwrap(response);
  }

  async verifyGst(restaurantId: string): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerVerifyGst({ restaurantId });
    return unwrap(response);
  }

  async rejectGst(restaurantId: string): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerRejectGst({ restaurantId });
    return unwrap(response);
  }

  async verifyFssai(restaurantId: string): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerVerifyFssai({ restaurantId });
    return unwrap(response);
  }

  async rejectFssai(restaurantId: string): Promise<TaxProfileResponseDto> {
    const response = await this.taxProfileService.taxProfileControllerRejectFssai({ restaurantId });
    return unwrap(response);
  }

  async getBankAccount(restaurantId: string): Promise<BankAccountResponseDto> {
    const response = await this.bankAccountService.bankAccountControllerFind({ restaurantId });
    return unwrap(response);
  }

  async verifyBankAccount(restaurantId: string): Promise<BankAccountResponseDto> {
    const response = await this.bankAccountService.bankAccountControllerVerify({ restaurantId });
    return unwrap(response);
  }

  async rejectBankAccount(restaurantId: string): Promise<BankAccountResponseDto> {
    const response = await this.bankAccountService.bankAccountControllerReject({ restaurantId });
    return unwrap(response);
  }

  /** Read-only admin review surfaces — platform ADMIN/SUPER_ADMIN JWTs are authorized against
   *  every restaurant by getRestaurantRole() on the backend, the same as the owner-facing
   *  endpoints these already-existing services call. */
  async getBranches(restaurantId: string): Promise<BranchResponseDto[]> {
    const response = await this.branchesService.branchesControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async getStaff(restaurantId: string): Promise<StaffResponseDto[]> {
    const response = await this.staffService.staffControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async getMedia(restaurantId: string): Promise<MediaResponseDto[]> {
    const response = await this.mediaService.mediaControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async getCompliance(restaurantId: string): Promise<ComplianceResponseDto> {
    const response = await this.complianceService.complianceControllerGetSnapshot({
      restaurantId,
    });
    return unwrap(response);
  }

  async getSettings(restaurantId: string): Promise<RestaurantSettingsResponseDto> {
    const response = await this.settingsService.settingsControllerFind({ restaurantId });
    return unwrap(response);
  }

  async getOnboarding(restaurantId: string): Promise<OnboardingResponseDto> {
    const response = await this.onboardingService.onboardingControllerGetState({ restaurantId });
    return unwrap(response);
  }

  async requestOnboardingChanges(
    restaurantId: string,
    items: OnboardingChangeItemDto[],
  ): Promise<OnboardingResponseDto> {
    const response = await this.onboardingService.onboardingControllerRequestChanges({
      restaurantId,
      body: { items },
    });
    return unwrap(response);
  }
}
