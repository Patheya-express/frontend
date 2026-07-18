import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { StaffResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';
import {
  ConfirmDialogComponent,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PaginationComponent,
  SearchInputComponent,
  SkeletonComponent,
  StatusChipComponent,
  type DataTableColumn,
  type StatusChipTone,
} from '@patheya-express-frontend/ui';
import { RestaurantStaffFacade } from '../../facades/restaurant-staff.facade';
import type { StaffFilter } from '../../store/restaurant-staff.store';

const ROLES: StaffResponseDto['role'][] = [
  'OWNER', 'CO_OWNER', 'BRANCH_MANAGER', 'KITCHEN_MANAGER', 'FINANCE_MANAGER', 'STAFF',
];

const FILTERS: Array<{ value: StaffFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Pending Invitations' },
  { value: 'REVOKED', label: 'Removed' },
];

const COLUMNS: DataTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'branch', label: 'Branch' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
];

@Component({
  selector: 'lib-staff-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DataTableComponent,
    PaginationComponent,
    SearchInputComponent,
    SkeletonComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    StatusChipComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './staff-list-page.component.html',
  styleUrl: './staff-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffListPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantStaffFacade);
  protected readonly context = inject(RestaurantContextService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly roles = ROLES;
  protected readonly filters = FILTERS;

  protected showInviteForm = false;
  protected editingStaffId: string | null = null;
  protected confirmRemoveId: string | null = null;

  protected readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['STAFF' as StaffResponseDto['role']],
    branchId: [''],
  });

  protected readonly editForm = this.fb.nonNullable.group({
    role: ['STAFF' as StaffResponseDto['role']],
    branchId: [''],
  });

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected onSearch(term: string): void {
    this.facade.setSearch(term);
  }

  protected onFilterChange(filter: StaffFilter): void {
    this.facade.setFilter(filter);
  }

  protected onPageChange(page: number): void {
    this.facade.setPage(page);
  }

  protected statusTone(status: StaffResponseDto['status']): StatusChipTone {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INVITED':
        return 'info';
      default:
        return 'neutral';
    }
  }

  protected branchName(branchId: string | undefined): string {
    if (!branchId) return 'All branches';
    return this.context.branches().find((b) => b.id === branchId)?.name ?? 'Branch';
  }

  protected staffName(member: StaffResponseDto): string {
    if (!member.user) return 'Unknown';
    return `${member.user.firstName} ${member.user.lastName ?? ''}`.trim();
  }

  protected openInviteForm(): void {
    this.inviteForm.reset({ email: '', role: 'STAFF', branchId: '' });
    this.showInviteForm = true;
  }

  protected closeInviteForm(): void {
    this.showInviteForm = false;
  }

  protected onInviteSubmit(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    const value = this.inviteForm.getRawValue();

    void this.facade
      .inviteStaff({
        email: value.email,
        role: value.role,
        branchId: value.branchId || undefined,
      })
      .then((ok) => {
        if (ok) this.showInviteForm = false;
      });
  }

  protected openEditForm(member: StaffResponseDto): void {
    this.editingStaffId = member.id;
    this.editForm.reset({ role: member.role, branchId: member.branchId ?? '' });
  }

  protected closeEditForm(): void {
    this.editingStaffId = null;
  }

  protected onEditSubmit(): void {
    if (!this.editingStaffId) return;

    const value = this.editForm.getRawValue();

    void this.facade
      .updateStaff(this.editingStaffId, { role: value.role, branchId: value.branchId || undefined })
      .then((ok) => {
        if (ok) this.editingStaffId = null;
      });
  }

  protected requestRemove(staffId: string): void {
    this.confirmRemoveId = staffId;
  }

  protected cancelRemove(): void {
    this.confirmRemoveId = null;
  }

  protected confirmRemove(): void {
    if (!this.confirmRemoveId) return;

    void this.facade.revokeStaff(this.confirmRemoveId).then(() => {
      this.confirmRemoveId = null;
    });
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
