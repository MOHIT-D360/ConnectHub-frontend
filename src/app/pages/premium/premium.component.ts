import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { BrandLogoComponent } from '../../components/shared/brand-logo.component';
import { AuthService } from '../../services/auth.service';
import { PaymentResponse, PaymentService, SubscriptionResponse } from '../../services/payment.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [CommonModule, RouterModule, BrandLogoComponent],
  template: `
    <main class="premium-shell" [class.checkout-open]="loading()">
      <nav class="premium-nav">
        <a routerLink="/chat" class="back-link">Back to chat</a>
        <app-brand-logo [compact]="true"></app-brand-logo>
      </nav>

      <section class="premium-hero">
        <p class="eyebrow">ConnectHub PRO</p>
        <h1>Make every conversation feel faster, brighter, and unmistakably yours.</h1>
        <p class="hero-copy">Unlock higher limits, advanced notification controls, premium visuals, and priority support.</p>
        <div class="hero-actions">
          <button class="premium-button" type="button" (click)="startPremium()" [disabled]="loading() || isPremiumActive()">
            <span class="crown" aria-hidden="true">&#9818;</span>
            {{ paymentButtonLabel() }}
          </button>
          <span class="status-pill">{{ subscription()?.status || 'Loading status' }}</span>
        </div>
      </section>

      <section class="comparison">
        <article class="plan-card free-card">
          <span class="plan-label">Free</span>
          <h2>For simple chats</h2>
          <ul>
            <li>Core messaging</li>
            <li>Basic media sharing</li>
            <li>Standard notifications</li>
            <li>Up to 5 group rooms</li>
          </ul>
        </article>

        <article class="plan-card pro-card">
          <span class="recommended">Recommended</span>
          <span class="plan-label">Premium</span>
          <h2>For power users</h2>
          <ul>
            <li>Unlimited group rooms</li>
            <li>10 GB media storage tier</li>
            <li>Higher message and upload rate limits</li>
            <li>Advanced unread notifications</li>
            <li>Premium profile badge and effects</li>
            <li>Priority support and AI-ready feature access</li>
          </ul>
        </article>
      </section>

      <section class="history-panel">
        <div>
          <p class="eyebrow">Billing</p>
          <h2>Transaction history</h2>
        </div>
        @if (payments().length === 0) {
          <p class="empty">No payments recorded yet.</p>
        } @else {
          <div class="payment-list">
            @for (payment of payments(); track payment.id) {
              <div class="payment-row">
                <span>{{ payment.razorpayPaymentId || 'Payment' }}</span>
                <strong>{{ formatMoney(payment) }}</strong>
                <small>{{ payment.status }} • {{ formatDate(payment.createdAt) }}</small>
              </div>
            }
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      height: 100dvh;
      min-height: 100dvh;
      overflow-y: auto;
      overflow-x: hidden;
      background:
        radial-gradient(circle at 20% 0%, rgba(16, 185, 129, 0.22), transparent 32%),
        radial-gradient(circle at 90% 12%, rgba(14, 165, 233, 0.2), transparent 30%),
        var(--color-bg-primary);
      color: var(--color-text-primary);
    }

    .premium-shell {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      min-height: 100dvh;
      padding: 20px 0 32px;
    }

    .premium-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: clamp(18px, 3vw, 34px);
    }

    .back-link,
    .status-pill {
      color: var(--color-text-primary);
      border: 1px solid var(--color-glass-border);
      background: var(--color-glass-light);
      border-radius: 999px;
      padding: 10px 14px;
      text-decoration: none;
      font-weight: 800;
      font-size: 13px;
    }

    .premium-hero {
      max-width: 820px;
      padding: clamp(8px, 2vw, 22px) 0 clamp(18px, 3vw, 30px);
    }

    .eyebrow,
    .plan-label {
      margin: 0 0 10px;
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    h1 {
      margin: 0;
      font-size: clamp(32px, 6vw, 62px);
      line-height: 1.02;
      letter-spacing: 0;
    }

    .hero-copy {
      max-width: 650px;
      color: var(--color-text-secondary);
      font-size: clamp(15px, 2vw, 18px);
      line-height: 1.5;
      margin: 18px 0 24px;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
    }

    .premium-button {
      position: relative;
      isolation: isolate;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 52px;
      max-width: 100%;
      padding: 0 22px;
      border-radius: 999px;
      color: white;
      font-weight: 900;
      background: linear-gradient(90deg, #22c55e, #06b6d4, #8b5cf6, #f59e0b, #22c55e);
      background-size: 280% 100%;
      box-shadow: 0 0 34px rgba(34, 197, 94, .35);
      animation: premiumFlow 5s linear infinite;
    }

    .premium-button:hover {
      transform: translateY(-2px) scale(1.01);
      box-shadow: 0 0 42px rgba(14, 165, 233, .42);
    }

    .premium-button:disabled {
      opacity: .75;
      cursor: default;
    }

    .crown {
      font-size: 18px;
    }

    .comparison {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 8px;
    }

    .plan-card,
    .history-panel {
      position: relative;
      padding: clamp(18px, 3vw, 26px);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-glass-border);
      background: color-mix(in srgb, var(--color-glass-elevated) 88%, transparent);
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }

    .pro-card::before {
      content: '';
      position: absolute;
      inset: -2px;
      z-index: -1;
      background: linear-gradient(120deg, #22c55e, #06b6d4, #8b5cf6, #f59e0b);
      filter: blur(16px);
      opacity: .5;
      animation: premiumGlow 4s ease-in-out infinite;
    }

    .recommended {
      display: inline-flex;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      color: white;
      background: linear-gradient(90deg, #22c55e, #06b6d4);
      font-size: 11px;
      font-weight: 900;
    }

    .plan-card h2,
    .history-panel h2 {
      margin: 0 0 18px;
      font-size: 24px;
    }

    ul {
      display: grid;
      gap: 10px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    li {
      color: var(--color-text-secondary);
      line-height: 1.45;
    }

    li::before {
      content: '✓';
      margin-right: 10px;
      color: var(--color-primary);
      font-weight: 900;
    }

    .history-panel {
      margin-top: 18px;
      margin-bottom: 12px;
    }

    .empty {
      color: var(--color-text-muted);
    }

    .payment-list {
      display: grid;
      gap: 10px;
    }

    .payment-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 14px;
      padding: 14px;
      border-radius: var(--radius-sm);
      background: var(--color-glass-light);
    }

    .payment-row small {
      grid-column: 1 / -1;
      color: var(--color-text-muted);
    }

    @keyframes premiumFlow {
      to { background-position: 280% 0; }
    }

    @keyframes premiumGlow {
      50% { opacity: .82; filter: blur(22px); }
    }

    @media (max-width: 760px) {
      .premium-shell {
        width: min(100% - 24px, 1120px);
        padding: 16px 0 28px;
      }

      .premium-nav {
        margin-bottom: 16px;
      }

      .comparison {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 34px;
      }

      .premium-button,
      .status-pill,
      .back-link {
        width: 100%;
      }

      .premium-nav .back-link {
        width: auto;
      }

      .hero-actions {
        align-items: stretch;
      }

      .payment-row {
        grid-template-columns: 1fr;
      }
    }

    @media (min-width: 900px) and (max-height: 780px) {
      .premium-shell {
        padding-top: 16px;
      }

      h1 {
        font-size: 46px;
      }

      .premium-hero {
        padding-bottom: 18px;
      }

      .plan-card,
      .history-panel {
        padding: 20px;
      }

      ul {
        gap: 8px;
      }
    }
  `]
})
export class PremiumComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);
  readonly subscription = signal<SubscriptionResponse | null>(null);
  readonly payments = signal<PaymentResponse[]>([]);
  readonly isPremiumActive = computed(() => {
    const subscription = this.subscription();
    if (subscription) {
      return subscription.plan?.toUpperCase() === 'PRO'
        && subscription.status?.toUpperCase() === 'ACTIVE';
    }

    return this.authService.isPro();
  });
  readonly paymentButtonLabel = computed(() => {
    if (this.isPremiumActive()) {
      return 'Premium Active';
    }
    if (this.loading()) {
      return 'Opening checkout...';
    }
    if (this.subscription()?.status?.toUpperCase() === 'PENDING') {
      return 'Complete payment';
    }
    return 'Get Premium';
  });

  ngOnInit(): void {
    this.refreshBilling();
  }

  startPremium(): void {
    if (this.isPremiumActive()) {
      return;
    }
    this.loading.set(true);
    this.paymentService.startCheckout().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: subscription => {
        this.subscription.set(subscription);
        if (subscription.plan?.toUpperCase() === 'PRO' && subscription.status?.toUpperCase() === 'ACTIVE') {
          this.authService.updateSubscriptionTier('PRO');
        }
        this.authService.fetchProfile().subscribe({ error: () => undefined });
        this.toastService.success('Payment verified. Premium is active.');
        this.refreshBilling();
      },
      error: error => this.toastService.error(error?.message || 'Could not start checkout.')
    });
  }

  formatMoney(payment: PaymentResponse): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: payment.currency || 'INR'
    }).format(Number(payment.amount || 0));
  }

  formatDate(value?: string): string {
    return value ? new Date(value).toLocaleDateString() : '';
  }

  private refreshBilling(): void {
    this.paymentService.status().subscribe({
      next: subscription => this.subscription.set(subscription),
      error: () => undefined
    });
    this.paymentService.payments().subscribe({
      next: payments => this.payments.set(payments),
      error: () => undefined
    });
  }
}
