import { Injectable } from '@angular/core';
import * as Sentry from '@sentry/capacitor';
import { scrubSensitiveData } from './sensitive-data';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Safe, structured metadata a call site can attach — see M7.9's exact list. Deliberately a loose
 * index signature on top of the named fields rather than a closed type: callers pass whatever
 * shape makes sense for their event, and {@link scrubSensitiveData} redacts anything matching a
 * known-sensitive key regardless of which field it's nested under.
 */
export interface LogMetadata {
  operation?: string;
  app?: string;
  environment?: string;
  version?: string;
  correlationId?: string | null;
  errorClassification?: string;
  feature?: string;
  networkState?: string;
  [key: string]: unknown;
}

/**
 * The one structured-logging abstraction for this frontend — see M7.9. Replaces ad hoc
 * `console.info(payload)`/`console.warn(payload)` calls (e.g. `delivery-dashboard.store.ts`'s
 * `logHeartbeatEvent`, which pre-dated this and said so explicitly in its own doc comment) with a
 * leveled API that also feeds Sentry, without turning every log line into its own reported event:
 *
 * - `debug`/`info`/`warn` — console only, plus a Sentry breadcrumb (context for whatever event
 *   happens *next*, not a report of their own). `debug` breadcrumbs are dropped outside local dev
 *   to avoid the "telemetry firehose" M7.20 rules out.
 * - `error` — console, a breadcrumb, AND `Sentry.captureMessage` — an actual reportable event, for
 *   genuinely actionable failures that aren't a thrown JS exception (a thrown exception goes
 *   through `ObservabilityErrorHandler` instead, never through here — see M7.11's "do not create
 *   duplicate reports for the same failure across multiple layers").
 *
 * Every metadata object passed to any level is scrubbed before it reaches Sentry (defense-in-depth
 * — callers are still expected to never pass a token/coordinate/payment field in the first place;
 * see M7.9's do-not-log list).
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private isDevelopment = false;

  /** Called once by `provideMobileObservability` — not part of the public logging API. */
  configure(environmentName: string): void {
    this.isDevelopment = environmentName === 'development';
  }

  debug(event: string, metadata?: LogMetadata): void {
    if (!this.isDevelopment) {
      return;
    }
    console.debug(event, metadata);
    this.breadcrumb('debug', event, metadata);
  }

  info(event: string, metadata?: LogMetadata): void {
    console.info(event, metadata);
    this.breadcrumb('info', event, metadata);
  }

  warn(event: string, metadata?: LogMetadata): void {
    console.warn(event, metadata);
    this.breadcrumb('warning', event, metadata);
  }

  error(event: string, metadata?: LogMetadata): void {
    console.error(event, metadata);
    this.breadcrumb('error', event, metadata);
    try {
      Sentry.captureMessage(event, {
        level: 'error',
        extra: metadata ? scrubSensitiveData(metadata) : undefined,
      });
    } catch {
      // Reporting must never throw back into the caller.
    }
  }

  private breadcrumb(level: Sentry.SeverityLevel, message: string, metadata?: LogMetadata): void {
    try {
      Sentry.addBreadcrumb({
        level,
        message,
        data: metadata ? scrubSensitiveData(metadata) : undefined,
      });
    } catch {
      // Reporting must never throw back into the caller.
    }
  }
}
