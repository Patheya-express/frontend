import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantSettingsFacade } from '../../facades/restaurant-settings.facade';

@Component({
  selector: 'lib-operational-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SkeletonComponent, ErrorStateComponent],
  templateUrl: './operational-settings-page.component.html',
  styleUrl: './operational-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationalSettingsPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantSettingsFacade);
  private readonly fb = inject(FormBuilder);

  private patched = false;

  protected readonly form = this.fb.nonNullable.group({
    autoAcceptOrders: [false],
    acceptanceTimeoutMinutes: [10, [Validators.required, Validators.min(1), Validators.max(120)]],
    isTemporarilyClosed: [false],
    temporaryClosureReason: [''],
    temporaryClosureUntil: [''],
    notifyOnNewOrder: [true],
    notifyOnOrderCancelled: [true],
    notifyOnRefund: [true],
    notifyOnCustomerMessage: [true],
  });

  constructor() {
    effect(() => {
      const settings = this.facade.settings();

      if (!settings || this.patched) {
        return;
      }

      this.patched = true;
      this.form.reset({
        autoAcceptOrders: settings.autoAcceptOrders,
        acceptanceTimeoutMinutes: settings.acceptanceTimeoutMinutes,
        isTemporarilyClosed: settings.isTemporarilyClosed,
        temporaryClosureReason: settings.temporaryClosureReason ?? '',
        temporaryClosureUntil: settings.temporaryClosureUntil
          ? settings.temporaryClosureUntil.slice(0, 16)
          : '',
        notifyOnNewOrder: settings.notifyOnNewOrder,
        notifyOnOrderCancelled: settings.notifyOnOrderCancelled,
        notifyOnRefund: settings.notifyOnRefund,
        notifyOnCustomerMessage: settings.notifyOnCustomerMessage,
      });
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected get hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  protected get showClosureFields(): boolean {
    return this.form.controls.isTemporarilyClosed.value;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    void this.facade
      .save({
        autoAcceptOrders: value.autoAcceptOrders,
        acceptanceTimeoutMinutes: value.acceptanceTimeoutMinutes,
        isTemporarilyClosed: value.isTemporarilyClosed,
        temporaryClosureReason: value.isTemporarilyClosed
          ? value.temporaryClosureReason || undefined
          : undefined,
        temporaryClosureUntil: value.isTemporarilyClosed && value.temporaryClosureUntil
          ? new Date(value.temporaryClosureUntil).toISOString()
          : undefined,
        notifyOnNewOrder: value.notifyOnNewOrder,
        notifyOnOrderCancelled: value.notifyOnOrderCancelled,
        notifyOnRefund: value.notifyOnRefund,
        notifyOnCustomerMessage: value.notifyOnCustomerMessage,
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
