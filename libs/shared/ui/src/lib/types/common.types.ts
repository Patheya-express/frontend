/** Shared size/tone vocabulary used across the enterprise component catalog, so every component
 *  that has a size or a semantic tone (badges, chips, buttons, toasts…) speaks the same language
 *  instead of each inventing its own union. */
export type MobileSize = 'sm' | 'md' | 'lg';

export type MobileTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

/** Icon content is always caller-provided markup (an `<svg>`/icon-font class/emoji passed via
 *  content projection) — shared-ui ships no icon set of its own, matching "no app-specific
 *  implementation": each app already owns its iconography choice. */
export type MobileIconPosition = 'leading' | 'trailing';
