import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { OperatingHourResponseDto, UpsertOperatingHourDto } from '@patheya-express-frontend/api-sdk';

interface ShiftRow {
  opensAt: string;
  closesAt: string;
}

interface DaySchedule {
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  shifts: ShiftRow[];
  copyTargets: Record<number, boolean>;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildEmptyWeek(): DaySchedule[] {
  return DAY_LABELS.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
    isClosed: false,
    shifts: [{ opensAt: '09:00', closesAt: '22:00' }],
    copyTargets: {},
  }));
}

/**
 * Enterprise weekly schedule editor for a single branch. Purely presentational + local edit
 * state — the parent page owns loading/saving via the facade, this component only emits the
 * flattened UpsertOperatingHourDto[] payload on save.
 */
@Component({
  selector: 'lib-operating-hours-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './operating-hours-editor.component.html',
  styleUrl: './operating-hours-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatingHoursEditorComponent implements OnChanges {
  @Input() hours: OperatingHourResponseDto[] = [];
  @Input() saving = false;
  @Input() error: string | null = null;
  @Input() savedAt: Date | null = null;

  @Output() save = new EventEmitter<UpsertOperatingHourDto[]>();

  protected week: DaySchedule[] = buildEmptyWeek();
  protected dirty = false;

  ngOnChanges(): void {
    this.week = this.hours.length > 0 ? this.fromApi(this.hours) : buildEmptyWeek();
    this.dirty = false;
  }

  private fromApi(hours: OperatingHourResponseDto[]): DaySchedule[] {
    return DAY_LABELS.map((label, dayOfWeek) => {
      const entries = hours.filter((hour) => hour.dayOfWeek === dayOfWeek);
      const isClosed = entries.length > 0 && entries.some((entry) => entry.isClosed);

      return {
        dayOfWeek,
        label,
        isClosed,
        shifts: isClosed || entries.length === 0
          ? [{ opensAt: '09:00', closesAt: '22:00' }]
          : entries.map((entry) => ({ opensAt: entry.opensAt, closesAt: entry.closesAt })),
        copyTargets: {},
      };
    });
  }

  protected markDirty(): void {
    this.dirty = true;
  }

  protected toggleClosed(day: DaySchedule): void {
    day.isClosed = !day.isClosed;
    this.markDirty();
  }

  protected addShift(day: DaySchedule): void {
    day.shifts.push({ opensAt: '11:00', closesAt: '15:00' });
    this.markDirty();
  }

  protected removeShift(day: DaySchedule, index: number): void {
    if (day.shifts.length <= 1) {
      return;
    }
    day.shifts.splice(index, 1);
    this.markDirty();
  }

  protected applyTwentyFourSeven(): void {
    this.week = this.week.map((day) => ({
      ...day,
      isClosed: false,
      shifts: [{ opensAt: '00:00', closesAt: '23:59' }],
    }));
    this.markDirty();
  }

  protected copyToSelected(source: DaySchedule): void {
    const targets = Object.entries(source.copyTargets)
      .filter(([, checked]) => checked)
      .map(([dayOfWeek]) => Number(dayOfWeek));

    if (targets.length === 0) {
      return;
    }

    this.week = this.week.map((day) =>
      targets.includes(day.dayOfWeek)
        ? {
            ...day,
            isClosed: source.isClosed,
            shifts: source.shifts.map((shift) => ({ ...shift })),
          }
        : day,
    );
    this.markDirty();
  }

  protected onSave(): void {
    const payload: UpsertOperatingHourDto[] = this.week.flatMap((day): UpsertOperatingHourDto[] =>
      day.isClosed
        ? [{ dayOfWeek: day.dayOfWeek, opensAt: '00:00', closesAt: '00:00', isClosed: true }]
        : day.shifts.map(
            (shift): UpsertOperatingHourDto => ({
              dayOfWeek: day.dayOfWeek,
              opensAt: shift.opensAt,
              closesAt: shift.closesAt,
              isClosed: false,
            }),
          ),
    );

    this.save.emit(payload);
  }
}
