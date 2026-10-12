import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DeliveryVehiclesFeatureService } from '../../services/delivery-vehicles.service';
import { DeliveryVehiclesStore } from '../../store/delivery-vehicles.store';
import { VehiclesPageComponent } from './vehicles-page.component';

/**
 * Vehicle form — registration number is the only required text field; year must be within the
 * backend's 1980–2100 bounds; fuel type is genuinely optional (it used to be forced to PETROL,
 * even for bicycles); every action reports success or the backend's reason.
 */
describe('Vehicles page and store', () => {
  let service: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    setPrimary: jest.Mock;
    deactivate: jest.Mock;
  };
  let fixture: ComponentFixture<VehiclesPageComponent>;
  let root: HTMLElement;

  async function render(): Promise<void> {
    service = {
      list: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation((dto: object) =>
          Promise.resolve({ id: 'vehicle-1', ...dto }),
        ),
      update: jest.fn(),
      setPrimary: jest.fn().mockResolvedValue({ id: 'vehicle-1' }),
      deactivate: jest
        .fn()
        .mockResolvedValue({ id: 'vehicle-1', isActive: false }),
    };
    TestBed.configureTestingModule({
      imports: [VehiclesPageComponent],
      providers: [
        { provide: DeliveryVehiclesFeatureService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(VehiclesPageComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function openForm(): void {
    (root.querySelector('.vehicles-page-add') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function control(name: string): HTMLInputElement | HTMLSelectElement {
    return root.querySelector(
      `[formControlName="${name}"]`,
    ) as HTMLInputElement;
  }

  function type(name: string, value: string): void {
    const field = control(name);
    field.value = value;
    field.dispatchEvent(
      new Event(field instanceof HTMLSelectElement ? 'change' : 'input'),
    );
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('marks registration number as required and everything else optional, with readable labels', async () => {
    await render();
    openForm();

    expect(root.querySelector('.form-required-legend')).not.toBeNull();
    expect((control('registrationNumber') as HTMLInputElement).required).toBe(
      true,
    );
    expect(root.textContent).toContain('Brand (optional)');
    expect(root.textContent).toContain('Fuel type (optional)');
    expect(root.textContent).toContain('Motorbike');
    expect((control('fuelType') as HTMLSelectElement).value).toBe('');
  });

  it('refuses to submit without a registration number and says why', async () => {
    await render();
    openForm();

    type('registrationNumber', '  ');
    await submit();

    expect(
      root.querySelector('#vehicle-registration-error')?.textContent?.trim(),
    ).toBe('Registration number is required.');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('enforces the backend year bounds', async () => {
    await render();
    openForm();

    type('year', '1975');
    expect(root.querySelector('#vehicle-year-error')?.textContent?.trim()).toBe(
      'Enter a year from 1980 onwards.',
    );

    type('year', '2101');
    expect(root.querySelector('#vehicle-year-error')?.textContent?.trim()).toBe(
      'Enter a year up to 2100.',
    );
  });

  it('does not invent a fuel type and trims what is sent', async () => {
    await render();
    openForm();

    type('vehicleType', 'BICYCLE');
    type('registrationNumber', ' KA01AB1234 ');
    type('brand', ' Hero ');
    await submit();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'BICYCLE',
        registrationNumber: 'KA01AB1234',
        brand: 'Hero',
        fuelType: undefined,
      }),
    );
    expect(root.querySelector('.form-success')?.textContent).toContain(
      'Vehicle saved.',
    );
  });

  it('reports each action and surfaces the backend reason on failure', async () => {
    await render();
    const store = TestBed.inject(DeliveryVehiclesStore);

    await store.setPrimary('vehicle-1');
    expect(store.saveSuccess()).toBe('Primary vehicle updated.');

    await store.deactivate('vehicle-1');
    expect(store.saveSuccess()).toBe('Vehicle deactivated.');

    service.create.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Registration number is required' },
      }),
    );
    expect(
      await store.create({ vehicleType: 'BIKE', registrationNumber: 'x' }),
    ).toBe(false);
    expect(store.saveError()).toBe('Registration number is required');
    expect(store.saveSuccess()).toBeNull();
  });
});
