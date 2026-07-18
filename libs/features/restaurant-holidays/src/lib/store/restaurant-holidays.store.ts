import { Injectable, computed, inject, signal } from '@angular/core';
import type { CreateHolidayDto, HolidayResponseDto, UpdateHolidayDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantHolidaysFeatureService } from '../services/restaurant-holidays.service';

@Injectable({ providedIn: 'root' })
export class RestaurantHolidaysStore {
  private readonly service = inject(RestaurantHolidaysFeatureService);

  private readonly _holidays = signal<HolidayResponseDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _actionError = signal<string | null>(null);

  readonly holidays = this._holidays.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly actionError = this._actionError.asReadonly();

  readonly sortedHolidays = computed(() =>
    [...this._holidays()].sort((a, b) => a.date.localeCompare(b.date)),
  );

  readonly upcomingHolidays = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.sortedHolidays().filter((holiday) => holiday.date >= today).slice(0, 5);
  });

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const holidays = await this.service.getHolidays();
      this._holidays.set(holidays);
    } catch {
      this._error.set('Unable to load the holiday calendar. Please try again.');
    } finally {
      this._loading.set(false);
    }
  }

  /** Creates one holiday row per requested year (see "repeats annually" — the backend models a
   *  holiday as a specific calendar date, so recurrence is expressed as multiple real rows
   *  rather than a stored recurrence rule). */
  async createHoliday(dto: CreateHolidayDto, repeatForYears: number[]): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      const [, month, day] = dto.date.split('-');
      const years = repeatForYears.length > 0 ? repeatForYears : [Number(dto.date.slice(0, 4))];

      const created = await Promise.all(
        years.map((year) =>
          this.service.createHoliday({
            ...dto,
            date: `${year}-${month}-${day}`,
          }),
        ),
      );

      this._holidays.set([...this._holidays(), ...created]);
      return true;
    } catch {
      this._actionError.set('Unable to add the holiday. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async updateHoliday(holidayId: string, dto: UpdateHolidayDto): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      const updated = await this.service.updateHoliday(holidayId, dto);
      this._holidays.set(this._holidays().map((h) => (h.id === holidayId ? updated : h)));
      return true;
    } catch {
      this._actionError.set('Unable to update the holiday. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async removeHoliday(holidayId: string): Promise<boolean> {
    this._saving.set(true);
    this._actionError.set(null);

    try {
      await this.service.removeHoliday(holidayId);
      this._holidays.set(this._holidays().filter((h) => h.id !== holidayId));
      return true;
    } catch {
      this._actionError.set('Unable to remove the holiday. Please try again.');
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
