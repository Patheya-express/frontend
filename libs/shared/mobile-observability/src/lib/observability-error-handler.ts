import { ErrorHandler, Injectable, inject } from '@angular/core';
import { createErrorHandler, type SentryErrorHandler } from '@sentry/angular';
import { classifyNetworkError } from '@patheya-express-frontend/mobile-networking';
import { LoggerService } from './logger.service';

/**
 * Angular's global `ErrorHandler` (M7.5) — installed once via `provideMobileObservability()`,
 * receives every uncaught error Angular sees: thrown errors that escape change detection,
 * `window.onerror`, and `window.onunhandledrejection` (the latter two already routed here by
 * `provideBrowserGlobalErrorListeners()`, which every app already calls — see M7.6, no separate
 * `window.addEventListener` wiring was added).
 *
 * Before reporting anything, classifies the error with M2's existing `classifyNetworkError`. A
 * recognized network-failure category (timeout/canceled/offline/unauthorized/forbidden/
 * client-error/server-error) reaching this top-level handler is an *expected operational
 * condition that escaped its usual facade/store catch block* — not a JS bug — so it's logged, not
 * captured as a crash (see M7.6/M7.11: "canceled HTTP requests should not be reported as fatal
 * application crashes," "expected auth refresh failures... not fatal crashes"). Everything else is
 * a genuinely unexpected exception and is delegated to `@sentry/angular`'s own `SentryErrorHandler`
 * (`createErrorHandler`), which reports it and preserves Angular's original console-logging
 * behavior — see M7.5's "original error behavior is preserved where appropriate."
 */
@Injectable()
export class ObservabilityErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly delegate: SentryErrorHandler = createErrorHandler({ showDialog: false });

  handleError(error: unknown): void {
    const category = classifyNetworkError(error);
    if (category !== 'unknown') {
      this.logger.warn('unhandled_network_error', { errorClassification: category });
      return;
    }

    try {
      this.delegate.handleError(error);
    } catch {
      // Reporting itself must never crash the app — fall back to a plain console message so the
      // failure is still visible locally even if the delegate throws.
      console.error(error);
    }
  }
}
