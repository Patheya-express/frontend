import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  MOBILE_MOTION_DURATIONS_MS,
  PaginationComponent,
  SkeletonComponent,
  prefersReducedMotion,
} from '@patheya-express-frontend/ui';
import { CustomerWalletFacade } from '../../facades/customer-wallet.facade';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

@Component({
  selector: 'lib-wallet-page',
  standalone: true,
  imports: [RouterLink, DatePipe, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './wallet-page.component.html',
  styleUrl: './wallet-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletPageComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(CustomerWalletFacade);

  /** Tweened display value for the balance card — counts up/down to `facade.balance()` on every
   *  change (initial load included, starting from 0, matching `MetricCardComponent`'s convention). */
  protected readonly displayBalance = signal(0);
  /** One-shot glow pulse (`mobile-anim-glow`, see its doc comment in keyframes.scss) for a balance
   *  that just increased — credited, refunded, or a realtime `wallet.balance.changed` top-up. Not
   *  shown on the first load or on a decrease (order payment), since those aren't "good news". */
  protected readonly balanceGlow = signal(false);

  private previousBalance: number | null = null;
  private animationFrame?: number;
  private glowTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      this.animateBalanceTo(this.facade.balance());
    });
  }

  ngOnInit(): void {
    void this.facade.loadBalance();
    void this.facade.loadTransactions();
  }

  ngOnDestroy(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
    clearTimeout(this.glowTimeout);
  }

  protected retry(): void {
    void this.facade.loadTransactions(this.facade.page());
  }

  protected retryBalance(): void {
    void this.facade.loadBalance();
  }

  protected onPageChange(page: number): void {
    void this.facade.loadTransactions(page);
  }

  protected isCredit(amount: number): boolean {
    return amount >= 0;
  }

  protected typeLabel(type: string): string {
    return type
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  private animateBalanceTo(target: number): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    const start = this.previousBalance ?? 0;
    const isIncrease = this.previousBalance !== null && target > this.previousBalance;
    this.previousBalance = target;

    if (isIncrease) {
      this.triggerGlow();
    }

    if (start === target || prefersReducedMotion()) {
      this.displayBalance.set(target);
      return;
    }

    const durationMs = MOBILE_MOTION_DURATIONS_MS.slower;
    const startTime = performance.now();

    const tick = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      this.displayBalance.set(start + (target - start) * easeOutCubic(progress));

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(tick);
      }
    };

    this.animationFrame = requestAnimationFrame(tick);
  }

  private triggerGlow(): void {
    clearTimeout(this.glowTimeout);
    this.balanceGlow.set(false);
    // Two RAFs so Angular flushes the class removal before re-adding it — matches the retrigger
    // pattern used for the menu item's cart-bump feedback.
    requestAnimationFrame(() => requestAnimationFrame(() => this.balanceGlow.set(true)));
    this.glowTimeout = setTimeout(() => this.balanceGlow.set(false), MOBILE_MOTION_DURATIONS_MS.slower);
  }
}
