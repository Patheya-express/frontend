import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

const DEBOUNCE_MS = 300;

@Component({
  selector: 'lib-search-input',
  standalone: true,
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInputComponent implements OnDestroy {
  @Input() placeholder = 'Search…';
  @Input() value = '';
  /** Emits at most once every 300ms, and only when the value actually changes. */
  @Output() valueChange = new EventEmitter<string>();

  private readonly input$ = new Subject<string>();
  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.input$.pipe(debounceTime(DEBOUNCE_MS), distinctUntilChanged()).subscribe((value) => {
      this.valueChange.emit(value);
    });
  }

  protected onInput(value: string): void {
    this.value = value;
    this.input$.next(value);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
