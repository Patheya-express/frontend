import { Injectable, inject } from '@angular/core';
import { DOCUMENT_GROUPS, DeliveryDocumentsStore } from '../store/delivery-documents.store';
import type { DeliveryDocumentType } from '../services/delivery-documents.service';

export { DOCUMENT_GROUPS };

@Injectable({ providedIn: 'root' })
export class DeliveryDocumentsFacade {
  private readonly store = inject(DeliveryDocumentsStore);

  readonly documents = this.store.documents;
  readonly documentsByType = this.store.documentsByType;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly uploadingKey = this.store.uploadingKey;
  readonly uploadError = this.store.uploadError;
  readonly history = this.store.history;
  readonly historyLoading = this.store.historyLoading;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.refresh();
  }

  upload(
    documentType: DeliveryDocumentType,
    file: File,
    options?: { vehicleId?: string; previousVersionId?: string; documentNumber?: string; expiryDate?: string },
  ): Promise<boolean> {
    return this.store.upload(documentType, file, options);
  }

  loadHistory(documentType: DeliveryDocumentType): Promise<void> {
    return this.store.loadHistory(documentType);
  }

  clearHistory(): void {
    this.store.clearHistory();
  }

  remove(documentId: string): Promise<boolean> {
    return this.store.remove(documentId);
  }
}
