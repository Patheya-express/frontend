import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { ErrorStateComponent, SkeletonComponent, prefersReducedMotion } from '@patheya-express-frontend/ui';
import {
  PlaycanvasRuntime,
  type ExperienceConfig,
  type ExperienceRegistry,
  type RuntimeStatus,
} from '@patheya-express-frontend/playcanvas-runtime';

/**
 * The Angular integration boundary for the Patheya PlayCanvas foundation (architecture validation
 * §4/§9; Phase 1 brief §4). Owns the canvas element and Angular's lifecycle only — every PlayCanvas
 * object (`Application`, `Entity`, `AssetRegistry`, `GraphicsDevice`) is owned exclusively by the
 * `PlaycanvasRuntime` instance this component creates and destroys; nothing PlayCanvas-shaped is
 * exposed through this component's own `@Input`/`@Output` surface.
 *
 * Everything from `ngAfterViewInit` onward — runtime creation, the resize/visibility observers,
 * the mobile pause/resume hooks — runs inside `NgZone.runOutsideAngular` (Phase 1 brief §7): the
 * app is zone.js-based with `OnPush` everywhere (architecture validation §3), so a PlayCanvas
 * render loop ticking inside Angular's zone would trigger a full change-detection pass on every
 * frame. The zone is re-entered in exactly one place — `onStatusChange` — because a status
 * transition is the one thing this component needs Angular to actually react to.
 */
@Component({
  selector: 'lib-playcanvas-scene',
  standalone: true,
  imports: [SkeletonComponent, ErrorStateComponent],
  templateUrl: './playcanvas-scene.component.html',
  styleUrl: './playcanvas-scene.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaycanvasSceneComponent implements AfterViewInit, OnDestroy {
  /** Plain data only (architecture validation §15/§16; Phase 1 brief §6) — required, since a scene
   *  with no configuration has nothing to render. */
  @Input({ required: true }) config!: ExperienceConfig;

  /**
   * Accessible label for when the canvas carries information nothing else on the page states
   * (architecture validation §18). Leave unset — the common case — when the same information
   * already exists as adjacent HTML; the canvas is then `aria-hidden` instead of exposed to
   * assistive technology as a second, redundant `role="img"`.
   */
  @Input() ariaLabel?: string;

  /**
   * Optional custom experience registry — the extension point a future business domain uses to
   * make its own registered experience types (e.g. a "product-showcase" factory) resolvable by
   * `config.experienceType`, without this component or `PlaycanvasRuntime` itself knowing anything
   * about what that experience does. Leave unset to use the runtime's own private default registry
   * (Phase 1's technical-demo experience only) — see `@patheya-express-frontend/playcanvas-runtime`'s
   * README for the full extension story. Not used by anything shipped in Phase 2.1.
   */
  @Input() experienceRegistry?: ExperienceRegistry;

  @Output() readonly statusChange = new EventEmitter<RuntimeStatus>();

  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly ngZone = inject(NgZone);
  private readonly mobilePlatform = inject(MobilePlatformService);

  protected readonly status = signal<RuntimeStatus>({ state: 'idle' });

  private runtime: PlaycanvasRuntime | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  /** Optimistic default — the loop starts as soon as `create()` resolves rather than waiting on
   *  the `IntersectionObserver`'s first (asynchronous) callback; if that callback then reports the
   *  canvas isn't actually visible, it immediately corrects course via `runtime.pause()`. */
  private isIntersecting = true;

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => void this.initialize());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.runtime?.destroy();
  }

  private async initialize(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;
    const runtime = new PlaycanvasRuntime({
      onStatusChange: (nextStatus) =>
        this.ngZone.run(() => {
          this.status.set(nextStatus);
          this.statusChange.emit(nextStatus);
        }),
      experienceRegistry: this.experienceRegistry,
    });
    this.runtime = runtime;

    await runtime.create(canvas, {
      ...this.config,
      // Reduced motion always wins, whether the caller already set it or not — the runtime never
      // reads Angular's reduced-motion signal itself (it has no Angular dependency at all), so
      // this is the one place that signal's current value crosses into the plain-data config.
      reducedMotion: this.config.reducedMotion || prefersReducedMotion(),
    });

    if (runtime.getStatus().state !== 'paused') {
      // Either create() failed (status is 'error', already surfaced via onStatusChange above) or
      // the component was destroyed while create() was still in flight (status is 'destroyed',
      // see PlaycanvasRuntime.destroy()'s doc comment) — either way, nothing left to wire up.
      return;
    }

    this.observeResize(canvas);
    this.observeVisibility(canvas);
    // Capacitor-native foreground/background — distinct from the IntersectionObserver above,
    // which tracks scroll position within an otherwise-active route (architecture validation §20).
    this.mobilePlatform.onPause(() => runtime.pause());
    this.mobilePlatform.onResume(() => {
      if (this.isIntersecting) {
        runtime.resume();
      }
    });

    if (this.isIntersecting) {
      runtime.start();
    }
  }

  private observeResize(canvas: HTMLCanvasElement): void {
    const target = canvas.parentElement ?? canvas;
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      this.runtime?.resize(Math.round(width), Math.round(height));
    });
    this.resizeObserver.observe(target);
  }

  private observeVisibility(canvas: HTMLCanvasElement): void {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      this.isIntersecting = entry.isIntersecting;
      if (entry.isIntersecting) {
        this.runtime?.resume();
      } else {
        this.runtime?.pause();
      }
    });
    this.intersectionObserver.observe(canvas);
  }
}
