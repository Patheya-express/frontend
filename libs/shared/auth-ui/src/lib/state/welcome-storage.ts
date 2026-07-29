/** Shared between `SplashPageComponent` (reads) and `WelcomePageComponent` (writes) — whether
 *  this device has ever reached the welcome screen, so it's only shown once per install, not on
 *  every cold launch. UI-only local preference, not session/auth state. */
export const HAS_SEEN_WELCOME_KEY = 'patheya.hasSeenWelcome';
