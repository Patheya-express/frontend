import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { UpsertOperatingHourDto } from '@patheya-express-frontend/api-sdk';
import { ConfirmDialogComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { MapPickerComponent, type PickedLocation } from '@patheya-express-frontend/map-picker';
import { RestaurantBranchesFacade } from '../../facades/restaurant-branches.facade';
import { OperatingHoursEditorComponent } from '../../components/operating-hours-editor/operating-hours-editor.component';

@Component({
  selector: 'lib-branch-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialogComponent,
    ErrorStateComponent,
    SkeletonComponent,
    OperatingHoursEditorComponent,
    MapPickerComponent,
  ],
  templateUrl: './branch-detail-page.component.html',
  styleUrl: './branch-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchDetailPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantBranchesFacade);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected branchId = '';
  protected isNew = false;
  protected notFound = false;
  protected confirmDeleteOpen = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    addressLine1: ['', Validators.required],
    addressLine2: [''],
    city: ['', Validators.required],
    state: ['', Validators.required],
    postalCode: ['', Validators.required],
    landmark: [''],
    latitude: [null as number | null],
    longitude: [null as number | null],
    phone: [''],
    emergencyContactName: [''],
    emergencyContactPhone: [''],
    deliveryRadiusKm: [5, Validators.min(0)],
    timezone: ['Asia/Kolkata'],
    isPrimary: [false],
    isActive: [true],
  });

  /** Prefills the map picker's marker when editing a branch that already has coordinates. */
  protected initialMapPosition: { lat: number; lng: number } | undefined = undefined;

  protected onLocationChange(location: PickedLocation): void {
    this.form.patchValue({
      latitude: location.lat,
      longitude: location.lng,
      addressLine1: location.addressLine1 || this.form.controls.addressLine1.value,
      city: location.city || this.form.controls.city.value,
      state: location.state || this.form.controls.state.value,
      postalCode: location.postalCode || this.form.controls.postalCode.value,
    });
  }

  ngOnInit(): void {
    this.branchId = this.route.snapshot.paramMap.get('branchId') ?? 'new';
    this.isNew = this.branchId === 'new';

    this.facade.initialize();

    if (!this.isNew) {
      void this.loadExisting();
    }
  }

  private async loadExisting(): Promise<void> {
    // Branches load as part of the list facade — wait for it, then look up this one.
    let branch = this.facade.getBranch(this.branchId);
    let attempts = 0;

    while (!branch && this.facade.loading() && attempts < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      branch = this.facade.getBranch(this.branchId);
      attempts++;
    }

    if (!branch) {
      this.notFound = true;
      return;
    }

    this.form.reset({
      name: branch.name,
      addressLine1: branch.addressLine1,
      addressLine2: branch.addressLine2 ?? '',
      city: branch.city,
      state: branch.state,
      postalCode: branch.postalCode,
      landmark: branch.landmark ?? '',
      latitude: branch.latitude ?? null,
      longitude: branch.longitude ?? null,
      phone: branch.phone ?? '',
      emergencyContactName: branch.emergencyContactName ?? '',
      emergencyContactPhone: branch.emergencyContactPhone ?? '',
      deliveryRadiusKm: branch.deliveryRadiusKm ?? 5,
      timezone: branch.timezone ?? 'Asia/Kolkata',
      isPrimary: branch.isPrimary,
      isActive: branch.isActive,
    });

    if (branch.latitude !== undefined && branch.longitude !== undefined) {
      this.initialMapPosition = { lat: branch.latitude, lng: branch.longitude };
    }

    void this.facade.loadOperatingHours(this.branchId);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const dto = {
      name: value.name,
      addressLine1: value.addressLine1,
      addressLine2: value.addressLine2 || undefined,
      city: value.city,
      state: value.state,
      postalCode: value.postalCode,
      landmark: value.landmark || undefined,
      latitude: value.latitude ?? undefined,
      longitude: value.longitude ?? undefined,
      phone: value.phone || undefined,
      emergencyContactName: value.emergencyContactName || undefined,
      emergencyContactPhone: value.emergencyContactPhone || undefined,
      deliveryRadiusKm: value.deliveryRadiusKm,
      timezone: value.timezone || undefined,
      isPrimary: value.isPrimary,
    };

    if (this.isNew) {
      void this.facade.createBranch(dto).then((ok) => {
        if (ok) {
          void this.router.navigate(['/branches']);
        }
      });
    } else {
      void this.facade.updateBranch(this.branchId, { ...dto, isActive: value.isActive }).then((ok) => {
        if (ok) {
          this.form.markAsPristine();
        }
      });
    }
  }

  protected onSaveHours(hours: UpsertOperatingHourDto[]): void {
    void this.facade.saveOperatingHours(this.branchId, hours);
  }

  protected openDeleteConfirm(): void {
    this.confirmDeleteOpen = true;
  }

  protected cancelDelete(): void {
    this.confirmDeleteOpen = false;
  }

  protected confirmDelete(): void {
    void this.facade.removeBranch(this.branchId).then((ok) => {
      this.confirmDeleteOpen = false;
      if (ok) {
        void this.router.navigate(['/branches']);
      }
    });
  }
}
