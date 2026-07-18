import { Injectable, inject } from '@angular/core';
import type { CreateHolidayDto, UpdateHolidayDto } from '@patheya-express-frontend/api-sdk';
import { RestaurantHolidaysStore } from '../store/restaurant-holidays.store';

@Injectable({ providedIn: 'root' })
export class RestaurantHolidaysFacade {
  private readonly store = inject(RestaurantHolidaysStore);

  readonly holidays = this.store.sortedHolidays;
  readonly upcomingHolidays = this.store.upcomingHolidays;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly saving = this.store.saving;
  readonly actionError = this.store.actionError;

  initialize(): void {
    void this.store.load();
  }

  refresh(): void {
    void this.store.load();
  }

  createHoliday(dto: CreateHolidayDto, repeatForYears: number[] = []): Promise<boolean> {
    return this.store.createHoliday(dto, repeatForYears);
  }

  updateHoliday(holidayId: string, dto: UpdateHolidayDto): Promise<boolean> {
    return this.store.updateHoliday(holidayId, dto);
  }

  removeHoliday(holidayId: string): Promise<boolean> {
    return this.store.removeHoliday(holidayId);
  }
}
