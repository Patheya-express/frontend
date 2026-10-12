/**
 * Moves keyboard/screen-reader focus to the first invalid control inside `host` after a failed
 * submit, so the user lands on the field that needs fixing instead of hunting for the message.
 * Relies on the `ng-invalid` class Angular's forms add to every invalid bound control.
 */
export function focusFirstInvalidControl(host: HTMLElement): void {
  const invalid = host.querySelector<HTMLElement>(
    'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
  );
  invalid?.focus();
}
