import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { MenuCategoryResponseDto } from '@patheya-express-frontend/api-sdk';
import { StatusChipComponent, prefersReducedMotion } from '@patheya-express-frontend/ui';

const CATEGORY_ELEMENT_PREFIX = 'category-';
/** How long a manual tab click suppresses scroll-spy auto-detection before it resumes tracking scroll position. */
const MANUAL_SELECT_SUPPRESS_MS = 600;

/**
 * Sticky horizontal tab row for jumping between `<lib-menu-category>` sections and highlighting
 * whichever one is currently scrolled into view. Reads section positions via `document.getElementById`
 * rather than `ViewChild` because the sections it tracks are rendered by its parent
 * (`RestaurantDetailsPageComponent`), not by this component — each `<lib-menu-category>` host needs
 * an `[id]="'category-' + category.id"` binding for this to find it.
 */
@Component({
  selector: 'lib-menu-category-tabs',
  standalone: true,
  imports: [StatusChipComponent],
  templateUrl: './menu-category-tabs.component.html',
  styleUrl: './menu-category-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuCategoryTabsComponent {
  readonly categories = input.required<MenuCategoryResponseDto[]>();

  private readonly tabsRow = viewChild.required<ElementRef<HTMLElement>>('tabsRow');

  protected readonly activeCategoryId = signal<string | undefined>(undefined);

  private observer?: IntersectionObserver;
  private suppressSpyUntil = 0;
  private hasRendered = false;

  constructor() {
    afterNextRender(() => {
      this.hasRendered = true;
      this.setupObserver();
    });

    effect(() => {
      this.categories();
      if (this.hasRendered) {
        queueMicrotask(() => this.setupObserver());
      }
    });

    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  protected selectCategory(categoryId: string): void {
    this.suppressSpyUntil = Date.now() + MANUAL_SELECT_SUPPRESS_MS;
    this.activeCategoryId.set(categoryId);

    document.getElementById(CATEGORY_ELEMENT_PREFIX + categoryId)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
    this.scrollTabIntoView(categoryId);
  }

  private setupObserver(): void {
    this.observer?.disconnect();
    this.observer = new IntersectionObserver((entries) => this.onIntersect(entries), {
      // Trigger band sits just under the sticky header+tabs stack and stops well before the
      // bottom of the viewport, so the "active" section is whichever one owns that band — not
      // simply whatever happens to be nearest the very top or bottom edge.
      rootMargin: '-136px 0px -65% 0px',
      threshold: 0,
    });

    for (const category of this.categories()) {
      const element = document.getElementById(CATEGORY_ELEMENT_PREFIX + category.id);
      if (element) {
        this.observer.observe(element);
      }
    }
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    if (Date.now() < this.suppressSpyUntil) {
      return;
    }

    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    const topEntry = visible[0];
    if (!topEntry) {
      return;
    }

    const categoryId = topEntry.target.id.slice(CATEGORY_ELEMENT_PREFIX.length);
    if (categoryId !== this.activeCategoryId()) {
      this.activeCategoryId.set(categoryId);
      this.scrollTabIntoView(categoryId);
    }
  }

  private scrollTabIntoView(categoryId: string): void {
    const tab = this.tabsRow().nativeElement.querySelector<HTMLElement>(`[data-tab-id="${categoryId}"]`);
    tab?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }
}
