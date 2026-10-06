import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FileUploadComponent } from '@patheya-express-frontend/ui';
import { PickupPhotoDialogComponent } from './pickup-photo-dialog.component';
import type { PickupPhotoDialogState } from '../../store/delivery-assignments.store';
import { DeliveryAssignmentsFacade } from '../../facades/delivery-assignments.facade';

/**
 * Focused coverage for the UI-1D migration onto ConfirmDialogComponent — ConfirmDialogComponent
 * itself already has thorough coverage (confirm-dialog.component.spec.ts); this only exercises
 * what's specific to this consumer: the facade wiring survives the template swap, the file-upload
 * widget still works via the `[dialogContent]` slot, and confirm is disabled until a file is
 * selected (the `confirmDisabled` wiring this consumer specifically needed).
 */
describe('PickupPhotoDialogComponent', () => {
  async function settle(fixture: { detectChanges(): void; whenStable(): Promise<void> }, rounds = 4): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      TestBed.tick();
      fixture.detectChanges();
      await Promise.resolve();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function baseDialogState(overrides: Partial<PickupPhotoDialogState> = {}): PickupPhotoDialogState {
    return {
      assignmentId: 'assignment-1',
      orderId: 'order-1',
      file: null,
      previewUrl: null,
      uploading: false,
      error: null,
      ...overrides,
    };
  }

  let pickupPhotoDialog: ReturnType<typeof signal<PickupPhotoDialogState | null>>;
  let facade: {
    pickupPhotoDialog: typeof pickupPhotoDialog;
    selectPickupPhoto: jest.Mock;
    submitPickupPhoto: jest.Mock;
    closePickupPhotoDialog: jest.Mock;
  };

  beforeEach(() => {
    pickupPhotoDialog = signal<PickupPhotoDialogState | null>(null);
    facade = {
      pickupPhotoDialog,
      selectPickupPhoto: jest.fn(),
      submitPickupPhoto: jest.fn().mockResolvedValue(undefined),
      closePickupPhotoDialog: jest.fn(),
    };
  });

  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [PickupPhotoDialogComponent],
      providers: [{ provide: DeliveryAssignmentsFacade, useValue: facade }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PickupPhotoDialogComponent);
    await settle(fixture);
    return fixture;
  }

  function confirmBtn(root: HTMLElement): HTMLButtonElement {
    return root.querySelector('.confirm-dialog-confirm') as HTMLButtonElement;
  }
  function cancelBtn(root: HTMLElement): HTMLButtonElement {
    return root.querySelector('.confirm-dialog-cancel') as HTMLButtonElement;
  }

  it('renders nothing when there is no pending pickup-photo dialog', async () => {
    const fixture = await createFixture();
    expect(fixture.nativeElement.querySelector('.confirm-dialog')).toBeNull();
  });

  it('renders the dialog with the file-upload widget once a dialog state exists', async () => {
    pickupPhotoDialog.set(baseDialogState());
    const fixture = await createFixture();
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.confirm-dialog')).not.toBeNull();
    expect(root.querySelector('.confirm-dialog-title')?.textContent).toContain('Pickup verification');
    expect(fixture.debugElement.query(By.directive(FileUploadComponent))).not.toBeNull();
  });

  it('forwards a selected file to the facade', async () => {
    pickupPhotoDialog.set(baseDialogState());
    const fixture = await createFixture();
    await settle(fixture);

    const file = new File(['x'], 'parcel.jpg', { type: 'image/jpeg' });
    fixture.debugElement.query(By.directive(FileUploadComponent)).triggerEventHandler('fileSelected', file);

    expect(facade.selectPickupPhoto).toHaveBeenCalledWith(file);
  });

  it('disables Submit until a file has been selected', async () => {
    pickupPhotoDialog.set(baseDialogState({ file: null }));
    const fixture = await createFixture();
    await settle(fixture);

    expect(confirmBtn(fixture.nativeElement).disabled).toBe(true);
  });

  it('enables Submit once a file is selected, and calls submitPickupPhoto on click', async () => {
    const file = new File(['x'], 'parcel.jpg', { type: 'image/jpeg' });
    pickupPhotoDialog.set(baseDialogState({ file }));
    const fixture = await createFixture();
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(confirmBtn(root).disabled).toBe(false);

    confirmBtn(root).click();

    expect(facade.submitPickupPhoto).toHaveBeenCalledTimes(1);
  });

  it('shows "Uploading…" and disables both actions while uploading', async () => {
    const file = new File(['x'], 'parcel.jpg', { type: 'image/jpeg' });
    pickupPhotoDialog.set(baseDialogState({ file, uploading: true }));
    const fixture = await createFixture();
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(confirmBtn(root).textContent).toContain('Uploading…');
    expect(confirmBtn(root).disabled).toBe(true);
    expect(cancelBtn(root).disabled).toBe(true);
  });

  it('renders the dialog error message when present', async () => {
    pickupPhotoDialog.set(baseDialogState({ error: 'Upload failed. Try again.' }));
    const fixture = await createFixture();
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Upload failed. Try again.');
  });

  it('calls closePickupPhotoDialog when Cancel is clicked', async () => {
    pickupPhotoDialog.set(baseDialogState());
    const fixture = await createFixture();
    await settle(fixture);

    cancelBtn(fixture.nativeElement).click();

    expect(facade.closePickupPhotoDialog).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog rendered (via displayDialog) immediately after the facade clears it, for the leave animation', async () => {
    pickupPhotoDialog.set(baseDialogState());
    const fixture = await createFixture();
    await settle(fixture);

    // Simulates what submitPickupPhoto()/closePickupPhotoDialog() do on success: clear the
    // facade's signal synchronously. ConfirmDialogComponent's own `open` input should immediately
    // reflect false, but the dialog itself (driven by this component's `displayDialog`) must not
    // vanish from the DOM in the same tick — that's what lets the shared leave animation play.
    pickupPhotoDialog.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.confirm-dialog')).not.toBeNull();
  });
});
