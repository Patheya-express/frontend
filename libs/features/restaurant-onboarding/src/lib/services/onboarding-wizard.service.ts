import { Injectable, inject } from '@angular/core';
import {
  RestaurantOnboardingService,
  RestaurantsService,
  RestaurantBranchesService,
  BranchOperatingHoursService,
  RestaurantBankAccountService,
  RestaurantTaxProfileService,
  RestaurantMediaService,
  RestaurantDocumentsService,
  type OnboardingResponseDto,
  type SubmitOnboardingDto,
  type RequestOnboardingChangesDto,
  type RestaurantResponseDto,
  type UpdateRestaurantDto,
  type BranchResponseDto,
  type CreateBranchDto,
  type UpdateBranchDto,
  type OperatingHourResponseDto,
  type UpsertOperatingHourDto,
  type BankAccountResponseDto,
  type UpsertBankAccountDto,
  type TaxProfileResponseDto,
  type UpsertTaxProfileDto,
  type MediaResponseDto,
  type DocumentResponseDto,
} from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';

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

export type OnboardingDocumentType = DocumentResponseDto['documentType'];
export type OnboardingMediaType = MediaResponseDto['type'];

/**
 * Orchestration-only service for the onboarding wizard: every step's actual data is saved
 * through the same already-completed SDK endpoints restaurant-profile/restaurant-branches/
 * restaurant-gallery use — this never duplicates that logic, it only additionally calls the
 * new onboarding progress endpoints (getState/completeStep/submit/requestChanges) around them.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingWizardFeatureService {
  private readonly onboardingService = inject(RestaurantOnboardingService);
  private readonly restaurantsService = inject(RestaurantsService);
  private readonly branchesService = inject(RestaurantBranchesService);
  private readonly operatingHoursService = inject(BranchOperatingHoursService);
  private readonly bankAccountService = inject(RestaurantBankAccountService);
  private readonly taxProfileService = inject(RestaurantTaxProfileService);
  private readonly mediaService = inject(RestaurantMediaService);
  private readonly documentsService = inject(RestaurantDocumentsService);
  private readonly currentRestaurant = inject(RestaurantContextService);

  async getState(): Promise<OnboardingResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.onboardingService.onboardingControllerGetState({ restaurantId });
    return unwrap(response);
  }

  async completeStep(step: number): Promise<OnboardingResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.onboardingService.onboardingControllerCompleteStep({
      restaurantId,
      step,
    });
    return unwrap(response);
  }

  async submit(dto: SubmitOnboardingDto): Promise<OnboardingResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.onboardingService.onboardingControllerSubmit({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async requestChanges(restaurantId: string, dto: RequestOnboardingChangesDto): Promise<OnboardingResponseDto> {
    const response = await this.onboardingService.onboardingControllerRequestChanges({
      restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async getRestaurant(): Promise<RestaurantResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.restaurantsControllerGetRestaurantById({ id: restaurantId });
    return unwrap(response);
  }

  async updateRestaurant(dto: UpdateRestaurantDto): Promise<RestaurantResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.restaurantsControllerUpdateRestaurant({
      id: restaurantId,
      body: dto,
    });
    return unwrap(response);
  }

  async getBranches(): Promise<BranchResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.branchesService.branchesControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async createBranch(dto: CreateBranchDto): Promise<BranchResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.branchesService.branchesControllerCreate({ restaurantId, body: dto });
    return unwrap(response);
  }

  async updateBranch(branchId: string, dto: UpdateBranchDto): Promise<BranchResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.branchesService.branchesControllerUpdate({ restaurantId, branchId, body: dto });
    return unwrap(response);
  }

  async getOperatingHours(branchId: string): Promise<OperatingHourResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.operatingHoursService.operatingHoursControllerFindAll({
      restaurantId,
      branchId,
    });
    return unwrap(response);
  }

  async replaceOperatingHours(
    branchId: string,
    hours: UpsertOperatingHourDto[],
  ): Promise<OperatingHourResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.operatingHoursService.operatingHoursControllerReplaceAll({
      restaurantId,
      branchId,
      body: { hours },
    });
    return unwrap(response);
  }

  async getBankAccount(): Promise<BankAccountResponseDto | null> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    try {
      const response = await this.bankAccountService.bankAccountControllerFind({ restaurantId });
      return unwrap(response);
    } catch {
      return null;
    }
  }

  async upsertBankAccount(dto: UpsertBankAccountDto): Promise<BankAccountResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.bankAccountService.bankAccountControllerUpsert({ restaurantId, body: dto });
    return unwrap(response);
  }

  async getTaxProfile(): Promise<TaxProfileResponseDto | null> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    try {
      const response = await this.taxProfileService.taxProfileControllerFind({ restaurantId });
      return unwrap(response);
    } catch {
      return null;
    }
  }

  async upsertTaxProfile(dto: UpsertTaxProfileDto): Promise<TaxProfileResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.taxProfileService.taxProfileControllerUpsert({ restaurantId, body: dto });
    return unwrap(response);
  }

  async getMedia(): Promise<MediaResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.mediaService.mediaControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async uploadMedia(type: OnboardingMediaType, file: File): Promise<MediaResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.mediaService.mediaControllerUpload({
      restaurantId,
      body: { file, type },
    });
    return unwrap(response);
  }

  async uploadLogo(file: File): Promise<RestaurantResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.restaurantsControllerUploadLogo({
      id: restaurantId,
      body: { file },
    });
    return unwrap(response);
  }

  async uploadBanner(file: File): Promise<RestaurantResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.restaurantsService.restaurantsControllerUploadBanner({
      id: restaurantId,
      body: { file },
    });
    return unwrap(response);
  }

  async getDocuments(): Promise<DocumentResponseDto[]> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.documentsService.documentsControllerFindAll({ restaurantId });
    return unwrap(response);
  }

  async uploadDocument(documentType: OnboardingDocumentType, file: File): Promise<DocumentResponseDto> {
    const restaurantId = await this.currentRestaurant.getRestaurantId();
    const response = await this.documentsService.documentsControllerUpload({
      restaurantId,
      body: { file, documentType },
    });
    return unwrap(response);
  }
}
