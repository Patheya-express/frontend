import { Injectable, inject } from '@angular/core';
import {
  DeliveryService,
  DeliveryVerificationAdminService,
  DeliveryComplianceAdminService,
  DeliveryDocumentsAdminService,
  DeliveryOnboardingAdminService,
  DeliveryBankAccountAdminService,
  AuditService,
  type PaginatedAdminDeliveryPartnersResponseDto,
  type DeliveryVerificationResponseDto,
  type DeliveryComplianceResponseDto,
  type DeliveryDocumentResponseDto,
  type DocumentVersionResponseDto,
  type DeliveryOnboardingResponseDto,
  type DeliveryOnboardingChangeItemDto,
  type DeliveryBankAccountResponseDto,
  type PaginatedAdminAuditLogsResponseDto,
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

export interface AdminDeliveryVerificationListParams {
  page: number;
  limit: number;
  search?: string;
  status?: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY' | 'SUSPENDED';
  verified?: boolean;
  online?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

type DeliveryDocumentType = DeliveryDocumentResponseDto['documentType'];

/**
 * Stateless backend orchestration for the admin delivery-verification queue — mirrors
 * AdminRestaurantVerificationService's shape exactly. Reuses DeliveryService's existing
 * admin list endpoint (already wired in `admin-delivery`) for the queue itself; there is no
 * separate "list" endpoint scoped to verification only.
 */
@Injectable({ providedIn: 'root' })
export class AdminDeliveryVerificationService {
  private readonly deliveryService = inject(DeliveryService);
  private readonly verificationService = inject(DeliveryVerificationAdminService);
  private readonly complianceService = inject(DeliveryComplianceAdminService);
  private readonly documentsService = inject(DeliveryDocumentsAdminService);
  private readonly onboardingService = inject(DeliveryOnboardingAdminService);
  private readonly bankAccountService = inject(DeliveryBankAccountAdminService);
  private readonly auditService = inject(AuditService);

  async getPartners(params: AdminDeliveryVerificationListParams): Promise<PaginatedAdminDeliveryPartnersResponseDto> {
    const response = await this.deliveryService.deliveryControllerGetAllForAdmin(params);
    return unwrap(response);
  }

  /** There is no admin-scoped "get verification status" endpoint — the compliance snapshot is
   *  the one read endpoint that already surfaces the current `verificationStage`. */
  async getCompliance(deliveryPartnerId: string): Promise<DeliveryComplianceResponseDto> {
    const response = await this.complianceService.adminComplianceControllerGetSnapshot({ deliveryPartnerId });
    return unwrap(response);
  }

  async advanceVerification(deliveryPartnerId: string): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.adminVerificationControllerAdvance({ deliveryPartnerId });
    return unwrap(response);
  }

  async rejectVerification(deliveryPartnerId: string, rejectedReason: string): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.adminVerificationControllerReject({
      deliveryPartnerId,
      body: { rejectedReason },
    });
    return unwrap(response);
  }

  async suspendVerification(deliveryPartnerId: string): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.adminVerificationControllerSuspend({ deliveryPartnerId });
    return unwrap(response);
  }

  async reinstateVerification(deliveryPartnerId: string): Promise<DeliveryVerificationResponseDto> {
    const response = await this.verificationService.adminVerificationControllerReinstate({ deliveryPartnerId });
    return unwrap(response);
  }

  async getDocuments(deliveryPartnerId: string): Promise<DeliveryDocumentResponseDto[]> {
    const response = await this.documentsService.adminDocumentsControllerFindAll({ deliveryPartnerId });
    return unwrap(response);
  }

  async getDocumentHistory(
    deliveryPartnerId: string,
    documentType: DeliveryDocumentType,
  ): Promise<DocumentVersionResponseDto[]> {
    const response = await this.documentsService.adminDocumentsControllerHistory({ deliveryPartnerId, documentType });
    return unwrap(response);
  }

  async verifyDocument(deliveryPartnerId: string, documentId: string): Promise<DeliveryDocumentResponseDto> {
    const response = await this.documentsService.adminDocumentsControllerVerify({ deliveryPartnerId, documentId });
    return unwrap(response);
  }

  async rejectDocument(
    deliveryPartnerId: string,
    documentId: string,
    rejectedReason: string,
  ): Promise<DeliveryDocumentResponseDto> {
    const response = await this.documentsService.adminDocumentsControllerReject({
      deliveryPartnerId,
      documentId,
      body: { rejectedReason },
    });
    return unwrap(response);
  }

  /** No admin-scoped "get onboarding state" read endpoint exists — `adminOnboardingControllerRequestChanges`
   *  is the only admin-facing onboarding endpoint, and it happens to return the full onboarding
   *  DTO as its mutation response. Onboarding progress/current-step is therefore only known
   *  after the admin has requested changes at least once in this session — there is nothing to
   *  fabricate here. */
  async requestOnboardingChanges(
    deliveryPartnerId: string,
    items: DeliveryOnboardingChangeItemDto[],
  ): Promise<DeliveryOnboardingResponseDto> {
    const response = await this.onboardingService.adminOnboardingControllerRequestChanges({
      deliveryPartnerId,
      body: { items },
    });
    return unwrap(response);
  }

  async verifyBankAccount(deliveryPartnerId: string): Promise<DeliveryBankAccountResponseDto> {
    const response = await this.bankAccountService.adminBankAccountControllerVerify({ deliveryPartnerId });
    return unwrap(response);
  }

  async rejectBankAccount(deliveryPartnerId: string): Promise<DeliveryBankAccountResponseDto> {
    const response = await this.bankAccountService.adminBankAccountControllerReject({ deliveryPartnerId });
    return unwrap(response);
  }

  /** Reuses the existing generic admin audit log (same endpoint `admin-audit` already calls),
   *  filtered by this partner's id via the `search` param ("Matches entity type/ID or actor
   *  name/email" per the backend). There is no delivery-partner-scoped audit endpoint — this is
   *  the same real, already-wired endpoint, not a fabricated one. */
  async getAuditLog(deliveryPartnerId: string, page: number, limit: number): Promise<PaginatedAdminAuditLogsResponseDto> {
    const response = await this.auditService.auditControllerGetAllForAdmin({
      search: deliveryPartnerId,
      page,
      limit,
    });
    return unwrap(response);
  }
}
