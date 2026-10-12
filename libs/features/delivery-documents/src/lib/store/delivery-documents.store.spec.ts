import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { DeliveryDocumentsFeatureService } from '../services/delivery-documents.service';
import { DeliveryDocumentsStore } from './delivery-documents.store';

/**
 * KYC document uploads — real type/size limits are checked before any network call, success is
 * confirmed, backend reasons are shown, and a retry replaces (never duplicates) the record.
 */
describe('DeliveryDocumentsStore', () => {
  let service: {
    findAll: jest.Mock;
    upload: jest.Mock;
    history: jest.Mock;
    remove: jest.Mock;
  };
  let store: DeliveryDocumentsStore;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      upload: jest.fn(),
      history: jest.fn().mockResolvedValue([]),
      remove: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DeliveryDocumentsFeatureService, useValue: service },
      ],
    });
    store = TestBed.inject(DeliveryDocumentsStore);
  });

  it('rejects an unsupported type without uploading', async () => {
    const ok = await store.upload(
      'AADHAAR',
      new File(['x'], 'id.gif', { type: 'image/gif' }),
    );

    expect(ok).toBe(false);
    expect(service.upload).not.toHaveBeenCalled();
    expect(store.uploadError()).toBe(
      'Please choose a JPG, PNG, WebP or PDF file.',
    );
  });

  it('rejects a file over the 10 MB document limit without uploading', async () => {
    const ok = await store.upload(
      'PAN',
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'pan.pdf', {
        type: 'application/pdf',
      }),
    );

    expect(ok).toBe(false);
    expect(service.upload).not.toHaveBeenCalled();
    expect(store.uploadError()).toContain('larger than 10 MB');
  });

  it('confirms a successful upload and shows the backend reason for a failure', async () => {
    const file = new File(['x'], 'rc.pdf', { type: 'application/pdf' });
    service.upload
      .mockRejectedValueOnce(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'File type not allowed' },
        }),
      )
      .mockResolvedValueOnce({ id: 'doc-2', documentType: 'VEHICLE_RC' });

    expect(await store.upload('VEHICLE_RC', file)).toBe(false);
    expect(store.uploadError()).toBe('File type not allowed');
    expect(store.uploadSuccess()).toBeNull();

    expect(await store.upload('VEHICLE_RC', file)).toBe(true);
    expect(store.uploadError()).toBeNull();
    expect(store.uploadSuccess()).toContain('Document uploaded');
  });

  it('a replacement upload replaces the current record instead of adding a duplicate', async () => {
    const file = new File(['x'], 'dl.jpg', { type: 'image/jpeg' });
    service.upload
      .mockResolvedValueOnce({ id: 'doc-1', documentType: 'DRIVING_LICENSE' })
      .mockResolvedValueOnce({ id: 'doc-1b', documentType: 'DRIVING_LICENSE' });

    await store.upload('DRIVING_LICENSE', file);
    await store.upload('DRIVING_LICENSE', file, { previousVersionId: 'doc-1' });

    const licences = store
      .documents()
      .filter((d) => d.documentType === 'DRIVING_LICENSE');
    expect(licences.map((d) => d.id)).toEqual(['doc-1b']);
  });
});
