import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantSettingsFacade } from '../../facades/restaurant-settings.facade';

const CHARGE_TYPES = ['NONE', 'FLAT', 'PERCENTAGE'] as const;

@Component({
  selector: 'lib-business-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SkeletonComponent, ErrorStateComponent],
  templateUrl: './business-settings-page.component.html',
  styleUrl: './business-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessSettingsPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantSettingsFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly chargeTypes = CHARGE_TYPES;
  private patched = false;

  protected readonly form = this.fb.nonNullable.group({
    currency: ['INR', Validators.required],
    minimumOrderAmount: [0, [Validators.required, Validators.min(0)]],
    serviceChargeType: ['NONE' as (typeof CHARGE_TYPES)[number]],
    serviceChargeValue: [0, Validators.min(0)],
    packingChargeType: ['NONE' as (typeof CHARGE_TYPES)[number]],
    packingChargeValue: [0, Validators.min(0)],
    orderPreparationDefaultMinutes: [0, Validators.min(0)],
    deliveryRadiusOverrideKm: [0, Validators.min(0)],
    restaurantNotes: [''],
    specialInstructions: [''],
  });

  constructor() {
    // Patches the form exactly once, the first time settings become available — a plain
    // subscription would otherwise re-run (and clobber in-progress edits) on every later
    // settings signal change, e.g. after a save from the Operational Settings page.
    effect(() => {
      const settings = this.facade.settings();

      if (!settings || this.patched) {
        return;
      }

      this.patched = true;
      this.form.reset({
        currency: settings.currency,
        minimumOrderAmount: settings.minimumOrderAmount,
        serviceChargeType: settings.serviceChargeType,
        serviceChargeValue: settings.serviceChargeValue,
        packingChargeType: settings.packingChargeType,
        packingChargeValue: settings.packingChargeValue,
        orderPreparationDefaultMinutes: settings.orderPreparationDefaultMinutes ?? 0,
        deliveryRadiusOverrideKm: settings.deliveryRadiusOverrideKm ?? 0,
        restaurantNotes: settings.restaurantNotes ?? '',
        specialInstructions: settings.specialInstructions ?? '',
      });
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected get hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    void this.facade
      .save({
        currency: value.currency,
        minimumOrderAmount: value.minimumOrderAmount,
        serviceChargeType: value.serviceChargeType,
        serviceChargeValue: value.serviceChargeValue,
        packingChargeType: value.packingChargeType,
        packingChargeValue: value.packingChargeValue,
        orderPreparationDefaultMinutes: value.orderPreparationDefaultMinutes,
        deliveryRadiusOverrideKm: value.deliveryRadiusOverrideKm,
        restaurantNotes: value.restaurantNotes || undefined,
        specialInstructions: value.specialInstructions || undefined,
      })
      .then((ok) => {
        if (ok) {
          this.form.markAsPristine();
        }
      });
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
