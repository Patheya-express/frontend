import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { HolidayResponseDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantContextService } from '@patheya-express-frontend/core';
import { ConfirmDialogComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { RestaurantHolidaysFacade } from '../../facades/restaurant-holidays.facade';

type ViewMode = 'calendar' | 'list';

interface CalendarCell {
  date: string | null;
  dayOfMonth: number | null;
  holidays: HolidayResponseDto[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

@Component({
  selector: 'lib-holiday-calendar-page',
  standalone: true,
  imports: [ReactiveFormsModule, SkeletonComponent, ErrorStateComponent, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './holiday-calendar-page.component.html',
  styleUrl: './holiday-calendar-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HolidayCalendarPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantHolidaysFacade);
  protected readonly context = inject(RestaurantContextService);
  private readonly fb = inject(FormBuilder);

  protected readonly monthNames = MONTH_NAMES;
  protected viewMode = signal<ViewMode>('calendar');
  protected cursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected editingId: string | null = null;
  protected confirmDeleteId: string | null = null;
  protected showForm = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    date: ['', Validators.required],
    branchId: [''],
    isClosed: [true],
    specialOpensAt: [''],
    specialClosesAt: [''],
    repeatAnnually: [false],
  });

  protected readonly calendarWeeks = computed(() => this.buildCalendar(this.cursor(), this.facade.holidays()));

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  protected previousMonth(): void {
    const current = this.cursor();
    this.cursor.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const current = this.cursor();
    this.cursor.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  private buildCalendar(monthStart: Date, holidays: HolidayResponseDto[]): CalendarCell[][] {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const holidaysByDate = new Map<string, HolidayResponseDto[]>();
    for (const holiday of holidays) {
      const list = holidaysByDate.get(holiday.date.slice(0, 10)) ?? [];
      list.push(holiday);
      holidaysByDate.set(holiday.date.slice(0, 10), list);
    }

    const cells: CalendarCell[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ date: null, dayOfMonth: null, holidays: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ date, dayOfMonth: day, holidays: holidaysByDate.get(date) ?? [] });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, dayOfMonth: null, holidays: [] });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return weeks;
  }

  protected openCreateForm(): void {
    this.editingId = null;
    this.form.reset({
      name: '',
      date: '',
      branchId: '',
      isClosed: true,
      specialOpensAt: '',
      specialClosesAt: '',
      repeatAnnually: false,
    });
    this.showForm = true;
  }

  protected openEditForm(holiday: HolidayResponseDto): void {
    this.editingId = holiday.id;
    this.form.reset({
      name: holiday.name,
      date: holiday.date.slice(0, 10),
      branchId: holiday.branchId ?? '',
      isClosed: holiday.isClosed,
      specialOpensAt: holiday.specialOpensAt ?? '',
      specialClosesAt: holiday.specialClosesAt ?? '',
      repeatAnnually: false,
    });
    this.showForm = true;
  }

  protected closeForm(): void {
    this.showForm = false;
  }

  protected get showSpecialHoursFields(): boolean {
    return !this.form.controls.isClosed.value;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const dto = {
      name: value.name,
      date: value.date,
      branchId: value.branchId || undefined,
      isClosed: value.isClosed,
      specialOpensAt: value.isClosed ? undefined : value.specialOpensAt || undefined,
      specialClosesAt: value.isClosed ? undefined : value.specialClosesAt || undefined,
    };

    if (this.editingId) {
      void this.facade.updateHoliday(this.editingId, dto).then((ok) => {
        if (ok) this.showForm = false;
      });
      return;
    }

    const year = Number(value.date.slice(0, 4));
    const repeatYears = value.repeatAnnually ? [year, year + 1, year + 2] : [year];

    void this.facade.createHoliday(dto, repeatYears).then((ok) => {
      if (ok) this.showForm = false;
    });
  }

  protected requestDelete(holidayId: string): void {
    this.confirmDeleteId = holidayId;
  }

  protected cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  protected confirmDelete(): void {
    if (!this.confirmDeleteId) return;

    void this.facade.removeHoliday(this.confirmDeleteId).then(() => {
      this.confirmDeleteId = null;
    });
  }

  protected branchName(branchId: string | undefined): string {
    if (!branchId) return 'All branches';
    return this.context.branches().find((b) => b.id === branchId)?.name ?? 'Branch';
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
