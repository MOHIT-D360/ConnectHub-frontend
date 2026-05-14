import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AnimatedBackgroundComponent } from '../../../components/shared/animated-background.component';
import { BrandLogoComponent } from '../../../components/shared/brand-logo.component';
import { AuthService } from '../../../core/services/auth.service';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { ToastService } from '../../../services/toast.service';
import { AUTH_UI_STYLES } from '../shared/auth-ui.styles';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AnimatedBackgroundComponent, BrandLogoComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="auth-container">
      <div class="logo-section">
        <app-brand-logo class="logo-badge"></app-brand-logo>
        <h1 class="logo-text">ConnectHub</h1>
        <p class="logo-tagline">Verify your registration email</p>
      </div>

      <div class="auth-card glass-elevated">
        <h2 class="card-title">Email Verification</h2>
        <p class="card-subtitle">Enter the 6-digit code sent to your inbox.</p>

        <form class="form-stack" [formGroup]="form" (ngSubmit)="verify()">
          <div class="input-group">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" placeholder="you@example.com">
          </div>

          <div class="input-group">
            <label for="otp">Verification Code</label>
            <input id="otp" class="otp-input" type="text" inputmode="numeric" maxlength="6" formControlName="otp" placeholder="000000">
          </div>

          @if (cooldown() > 0) {
            <p class="countdown">Resend in {{ cooldown() }}s</p>
          } @else {
            <button type="button" class="btn-link" (click)="resend()">Resend Code</button>
          }

          <button class="btn btn-primary" type="submit" [disabled]="isLoading()">
            {{ isLoading() ? 'Verifying...' : 'Verify Email' }}
          </button>
        </form>

        <p class="footer-text" style="margin-top: 18px;">
          Wrong account? <a routerLink="/register" class="link">Register again</a>
        </p>
      </div>
    </div>
  `,
  styles: AUTH_UI_STYLES
})
export class VerifyEmailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  isLoading = signal(false);
  cooldown = signal(0);

  form = this.fb.nonNullable.group({
    email: [this.tokenStorage.getRegistrationEmail(), [Validators.required, Validators.email]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email') || this.tokenStorage.getRegistrationEmail();
    const otpAlreadySent = this.route.snapshot.queryParamMap.get('otpSent') === 'true';
    if (email) {
      this.form.controls.email.setValue(email);
      if (otpAlreadySent) {
        this.startCooldown();
      }
    }
  }

  verify(): void {
    if (this.form.invalid) {
      this.toastService.error('Enter your email and 6-digit OTP.');
      return;
    }

    this.isLoading.set(true);
    const { email, otp } = this.form.getRawValue();
    this.authService.verifyRegistrationOtp(email.trim(), otp).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.tokenStorage.clearRegistrationEmail();
        this.toastService.success('Email verified successfully.');
        this.router.navigate(['/chat']);
      },
      error: error => this.toastService.error(this.authService.buildErrorMessage(error))
    });
  }

  resend(): void {
    const email = this.form.controls.email.value.trim();
    if (this.form.controls.email.invalid || this.cooldown() > 0) {
      this.toastService.error('Enter a valid email first.');
      return;
    }

    this.isLoading.set(true);
    this.authService.resendRegistrationOtp(email).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.startCooldown();
        this.toastService.success('Verification code resent.');
      },
      error: error => this.toastService.error(this.authService.buildErrorMessage(error))
    });
  }

  private startCooldown(): void {
    this.cooldown.set(60);
    const interval = window.setInterval(() => {
      this.cooldown.update(value => {
        if (value <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

}
