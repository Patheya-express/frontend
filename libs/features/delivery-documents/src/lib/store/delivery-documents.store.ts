import { Injectable, computed, inject, signal } from '@angular/core';
import type { DeliveryDocumentResponseDto, DocumentVersionResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryDocumentsFeatureService, type DeliveryDocumentType } from '../services/delivery-documents.service';

export interface DocumentGroup {
  key: string;
  label: string;
  types: DeliveryDocumentType[];
}

export const DOCUMENT_GROUPS: DocumentGroup[] = [
  { key: 'license', label: 'License', types: ['DRIVING_LICENSE'] },
  { key: 'identity', label: 'Identity', types: ['AADHAAR', 'PAN'] },
  {
    key: 'vehicle',
    label: 'Vehicle',
    types: ['VEHICLE_RC', 'VEHICLE_INSURANCE', 'VEHICLE_FITNESS', 'VEHICLE_POLLUTION', 'VEHICLE_PHOTO'],
  },
  { key: 'selfie', label: 'Selfie', types: ['SELFIE', 'PROFILE_PHOTO', 'BACKGROUND_VERIFICATION'] },
];

@Injectable({ providedIn: 'root' })
export class DeliveryDocumentsStore {
  private readonly service = inject(DeliveryDocumentsFeatureService);

  private readonly _documents = signal<DeliveryDocumentResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _uploadingKey = signal<string | null>(null);
  private readonly _uploadError = signal<string | null>(null);
  private readonly _history = signal<DocumentVersionResponseDto[]>([]);
  private readonly _historyLoading = signal(false);

  readonly documents = this._documents.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly uploadingKey = this._uploadingKey.asReadonly();
  readonly uploadError = this._uploadError.asReadonly();
  readonly history = this._history.asReadonly();
  readonly historyLoading = this._historyLoading.asReadonly();

  readonly documentsByType = computed(() => {
    const map = new Map<DeliveryDocumentType, DeliveryDocumentResponseDto>();
    for (const doc of this._documents()) {
      map.set(doc.documentType, doc);
    }
    return map;
  });

  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetch();
    }
    return this.loadPromise;
  }

  refresh(): Promise<void> {
    this.loadPromise = this.fetch();
    return this.loadPromise;
  }

  private async fetch(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const documents = await this.service.findAll();
      this._documents.set(documents);
    } catch {
      this._error.set('Unable to load your documents. Please refresh and try again.');
    } finally {
      this._loading.set(false);
    }
  }

  async upload(
    documentType: DeliveryDocumentType,
    file: File,
    options?: { vehicleId?: string; previousVersionId?: string; documentNumber?: string; expiryDate?: string },
  ): Promise<boolean> {
    this._uploadingKey.set(documentType);
    this._uploadError.set(null);
    try {
      const document = await this.service.upload(documentType, file, options);
      this._documents.update((existing) => [
        ...existing.filter((d) => d.documentType !== documentType || d.vehicleId !== options?.vehicleId),
        document,
      ]);
      return true;
    } catch {
      this._uploadError.set('Unable to upload this document. Please try again.');
      return false;
    } finally {
      this._uploadingKey.set(null);
    }
  }

  async loadHistory(documentType: DeliveryDocumentType): Promise<void> {
    this._historyLoading.set(true);
    try {
      const history = await this.service.history(documentType);
      this._history.set(history);
    } catch {
      this._history.set([]);
    } finally {
      this._historyLoading.set(false);
    }
  }

  clearHistory(): void {
    this._history.set([]);
  }

  async remove(documentId: string): Promise<boolean> {
    try {
      await this.service.remove(documentId);
      this._documents.update((existing) => existing.filter((d) => d.id !== documentId));
      return true;
    } catch {
      this._uploadError.set('Unable to remove this document. Please try again.');
      return false;
    }
  }
}
