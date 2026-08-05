import { HttpErrorResponse } from '@angular/common/http';

/** Prefers the backend's own error message when the API returned one, falling back otherwise. */
export function extractHttpErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
    return error.error.message;
  }
  return fallback;
}
