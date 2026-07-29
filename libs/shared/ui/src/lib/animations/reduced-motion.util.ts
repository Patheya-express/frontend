import { signal } from '@angular/core';

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reactive `prefers-reduced-motion` — a module-level singleton (one listener for the whole app,
 * not one per component) that JS-driven animation timing reads to skip/shorten itself, e.g. a
 * directive deciding whether to wait for an `animationend` event at all. Pure-CSS animations
 * don't need this: `keyframes.scss`'s own `@media (prefers-reduced-motion: reduce)` block already
 * handles them.
 */
export const prefersReducedMotion = signal(readPrefersReducedMotion());

if (typeof window !== 'undefined' && window.matchMedia) {
  window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', (event) => prefersReducedMotion.set(event.matches));
}
