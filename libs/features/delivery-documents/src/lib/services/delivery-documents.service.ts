import { Injectable, inject } from '@angular/core';
import {
  DeliveryDocumentsService as DeliveryDocumentsSdkService,
  type DeliveryDocumentResponseDto,
  type DocumentVersionResponseDto,
} from '@patheya-express-frontend/api-sdk';

interface ApiEnvelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
}

function unwrap<T>(response: T): T {
  return (response as unknown as ApiEnvelope<T>).data;
}

export type DeliveryDocumentType = DeliveryDocumentResponseDto['documentType'];

@Injectable({ providedIn: 'root' })
export class DeliveryDocumentsFeatureService {
  private readonly documentsService = inject(DeliveryDocumentsSdkService);

  async findAll(): Promise<DeliveryDocumentResponseDto[]> {
    const response = await this.documentsService.deliveryDocumentsControllerFindAll();
    return unwrap(response);
  }

  async upload(
    documentType: DeliveryDocumentType,
    file: File,
    options?: { vehicleId?: string; previousVersionId?: string; documentNumber?: string; expiryDate?: string },
  ): Promise<DeliveryDocumentResponseDto> {
    const response = await this.documentsService.deliveryDocumentsControllerUpload({
      body: {
        file,
        documentType,
        vehicleId: options?.vehicleId,
        previousVersionId: options?.previousVersionId,
        documentNumber: options?.documentNumber,
        expiryDate: options?.expiryDate,
      },
    });
    return unwrap(response);
  }

  async history(documentType: DeliveryDocumentType): Promise<DocumentVersionResponseDto[]> {
    const response = await this.documentsService.deliveryDocumentsControllerHistory({ documentType });
    return unwrap(response);
  }

  async remove(documentId: string): Promise<void> {
    await this.documentsService.deliveryDocumentsControllerRemove({ documentId });
  }
}
