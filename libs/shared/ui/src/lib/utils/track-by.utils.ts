/**
 * `@for` track-expression helpers — Angular 21's control flow takes `track` as an inline
 * per-item expression (not a bound `trackBy` function like legacy `*ngFor`), so these are plain
 * functions called directly from the expression rather than a directive input.
 *
 * @example @for (restaurant of restaurants(); track trackById(restaurant)) { … }
 * @example @for (order of orders(); track trackByKey(o => o.referenceLabel)(order)) { … }
 */
export function trackById<T extends { id: string | number }>(item: T): T['id'] {
  return item.id;
}

export function trackByKey<T, K>(keySelector: (item: T) => K): (item: T) => K {
  return (item: T): K => keySelector(item);
}
