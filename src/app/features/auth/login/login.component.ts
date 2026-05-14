import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { finalize } from 'rxjs';
import { AnimatedBackgroundComponent } from '../../../components/shared/animated-background.component';
import { BrandLogoComponent } from '../../../components/shared/brand-logo.component';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { AUTH_UI_STYLES } from '../shared/auth-ui.styles';

type LoginMethod = 'email' | 'phone' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AnimatedBackgroundComponent, BrandLogoComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="auth-container">
      <div class="logo-section">
        <app-brand-logo class="logo-badge"></app-brand-logo>
        <h1 class="logo-text">ConnectHub</h1>
        <p class="logo-tagline">Premium Real-time Communication</p>
      </div>

      <div class="auth-card glass-elevated" [@fadeUp]>
        <h2 class="card-title">Welcome Back</h2>
        <p class="card-subtitle">Sign in to your account</p>

        <div class="tab-selector">
          <button type="button" class="tab" [class.active]="selectedMethod() === 'email'" (click)="selectMethod('email')">
            Email OTP
          </button>
          <button type="button" class="tab" [class.active]="selectedMethod() === 'phone'" (click)="selectMethod('phone')">
            Phone OTP
          </button>
          <button type="button" class="tab" [class.active]="selectedMethod() === 'password'" (click)="selectMethod('password')">
            Password
          </button>
        </div>

        @switch (selectedMethod()) {
          @case ('email') {
            <form class="form-stack" [formGroup]="emailForm" (ngSubmit)="emailOtpSent() ? verifyEmailOtp() : requestEmailOtp()">
              <div class="input-group">
                <label for="email">Email</label>
                <input id="email" type="email" formControlName="email" placeholder="you@example.com">
                @if (submitted() && emailForm.controls.email.invalid) {
                  <span class="input-error">Enter a valid email.</span>
                }
              </div>

              @if (emailOtpSent()) {
                <div class="otp-section">
                  <div class="input-group">
                    <label for="emailOtp">Verification Code</label>
                    <input id="emailOtp" class="otp-input" type="text" inputmode="numeric" maxlength="6" formControlName="otp" placeholder="000000">
                  </div>
                  @if (emailCooldown() > 0) {
                    <p class="countdown">Resend in {{ emailCooldown() }}s</p>
                  } @else {
                    <button type="button" class="btn-link" (click)="requestEmailOtp()">Resend Code</button>
                  }
                  <button class="btn btn-primary" type="submit" [disabled]="isLoading()">
                    {{ isLoading() ? 'Verifying...' : 'Verify' }}
                  </button>
                  <button type="button" class="btn-link" (click)="useDifferentEmail()">Use different email</button>
                </div>
              } @else {
                <button class="btn btn-primary" type="submit" [disabled]="isLoading()">
                  {{ isLoading() ? 'Sending...' : 'Send Verification Code' }}
                </button>
              }
            </form>
          }

          @case ('phone') {
            <form class="form-stack" [formGroup]="phoneForm" (ngSubmit)="phoneOtpSent() ? verifyPhoneOtp() : requestPhoneOtp()">
              <div class="input-group">
                <label for="phone">Phone Number</label>
                <div class="phone-input-group">
                  <span class="phone-prefix">+91</span>
                  <input id="phone" type="tel" formControlName="phoneNumber" placeholder="9876543210">
                </div>
                @if (submitted() && phoneForm.controls.phoneNumber.invalid) {
                  <span class="input-error">Enter a valid Indian phone number.</span>
                }
              </div>

              @if (phoneOtpSent()) {
                <div class="otp-section">
                  <div class="input-group">
                    <label for="phoneOtp">Verification Code</label>
                    <input id="phoneOtp" class="otp-input" type="text" inputmode="numeric" maxlength="6" formControlName="otp" placeholder="000000">
                  </div>
                  @if (phoneCooldown() > 0) {
                    <p class="countdown">Resend in {{ phoneCooldown() }}s</p>
                  } @else {
                    <button type="button" class="btn-link" (click)="requestPhoneOtp()">Resend Code</button>
                  }
                  <button class="btn btn-primary" type="submit" [disabled]="isLoading()">
                    {{ isLoading() ? 'Verifying...' : 'Verify' }}
                  </button>
                  <button type="button" class="btn-link" (click)="useDifferentPhone()">Use different number</button>
                </div>
              } @else {
                <button class="btn btn-primary" type="submit" [disabled]="isLoading()">
                  {{ isLoading() ? 'Sending...' : 'Send OTP' }}
                </button>
              }
            </form>
          }

          @case ('password') {
            <form class="form-stack" [formGroup]="passwordForm" (ngSubmit)="loginWithPassword()">
              <div class="input-group">
                <label for="identifier">Username or Email</label>
                <input id="identifier" type="text" formControlName="identifier" placeholder="alexj or alex@example.com">
              </div>
              <div class="input-group">
                <label for="password">Password</label>
                <div class="password-input-group">
                  <input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="Password">
                  <button type="button" class="password-toggle" (click)="togglePasswordVisibility()">
                    {{ showPassword() ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>
              <a routerLink="/forgot-password" class="btn-link">Forgot password?</a>
              <button class="btn btn-primary" type="submit" [disabled]="isLoading() || passwordForm.invalid">
                {{ isLoading() ? 'Signing in...' : 'Sign In' }}
              </button>
            </form>
          }
        }

        <div class="oauth-section">
          <div class="divider"><span>or continue with</span></div>
          <div class="oauth-buttons">
            <button type="button" class="oauth-btn" (click)="startOAuth('google')">Google</button>
            <button type="button" class="oauth-btn" (click)="startOAuth('github')">GitHub</button>
          </div>
        </div>

        <button type="button" class="btn btn-ghost" (click)="loginAsGuest()" [disabled]="isLoading()">
          Continue as Guest
        </button>

        <p class="footer-text" style="margin-top: 18px;">
          Don't have an account? <a routerLink="/register" class="link">Create one now</a>
        </p>
      </div>
    </div>
  `,
  styles: AUTH_UI_STYLES,
  animations: [
    trigger('fadeUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  selectedMethod = signal<LoginMethod>('password');
  showPassword = signal(false);
  isLoading = signal(false);
  submitted = signal(false);
  emailOtpSent = signal(false);
  phoneOtpSent = signal(false);
  emailCooldown = signal(0);
  phoneCooldown = signal(0);

  emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    otp: ['', [Validators.pattern(/^\d{6}$/)]]
  });

  phoneForm = this.fb.nonNullable.group({
    phoneNumber: ['', [Validators.required, Validators.pattern(/^(\+91)?[6-9]\d{9}$/)]],
    otp: ['', [Validators.pattern(/^\d{6}$/)]]
  });

  passwordForm = this.fb.nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required]
  });

  selectMethod(method: LoginMethod): void {
    this.selectedMethod.set(method);
    this.submitted.set(false);
  }

  requestEmailOtp(): void {
    this.submitted.set(true);
    if (this.emailForm.controls.email.invalid || this.emailCooldown() > 0) {
      return;
    }

    this.isLoading.set(true);
    this.authService.requestEmailOtp(this.emailForm.controls.email.value).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.emailOtpSent.set(true);
        this.startCooldown(this.emailCooldown);
        this.toastService.success('OTP sent to your email');
      },
      error: error => this.showError(error)
    });
  }

  verifyEmailOtp(): void {
    this.submitted.set(true);
    if (this.emailForm.invalid) {
      this.toastService.error('Enter the 6-digit OTP.');
      return;
    }

    this.isLoading.set(true);
    this.authService.verifyEmailOtp(this.emailForm.controls.email.value, this.emailForm.controls.otp.value).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => this.authSuccess('Logged in successfully.'),
      error: error => this.showError(error)
    });
  }

  requestPhoneOtp(): void {
    this.submitted.set(true);
    if (this.phoneForm.controls.phoneNumber.invalid || this.phoneCooldown() > 0) {
      return;
    }

    this.isLoading.set(true);
    this.authService.requestPhoneOtp(this.normalizedPhone()).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.phoneOtpSent.set(true);
        this.startCooldown(this.phoneCooldown);
        this.toastService.success('OTP sent to your phone');
      },
      error: error => this.showError(error)
    });
  }

  verifyPhoneOtp(): void {
    this.submitted.set(true);
    if (this.phoneForm.invalid) {
      this.toastService.error('Enter the 6-digit OTP.');
      return;
    }

    this.isLoading.set(true);
    this.authService.verifyPhoneOtp(this.normalizedPhone(), this.phoneForm.controls.otp.value).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => this.authSuccess('Logged in successfully.'),
      error: error => this.showError(error)
    });
  }

  loginWithPassword(): void {
    this.submitted.set(true);
    if (this.passwordForm.invalid) {
      this.toastService.error('Please enter username/email and password.');
      return;
    }

    this.isLoading.set(true);
    const { identifier, password } = this.passwordForm.getRawValue();
    this.authService.loginWithPassword(identifier.trim(), password).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => this.authSuccess('Welcome back!'),
      error: error => this.showError(error)
    });
  }

  loginAsGuest(): void {
    this.isLoading.set(true);
    this.authService.loginAsGuest().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => this.authSuccess('Continuing as guest.'),
      error: error => this.showError(error)
    });
  }

  startOAuth(provider: 'google' | 'github'): void {
    this.authService.startOAuth(provider);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  useDifferentEmail(): void {
    this.emailOtpSent.set(false);
    this.emailForm.controls.otp.reset('');
  }

  useDifferentPhone(): void {
    this.phoneOtpSent.set(false);
    this.phoneForm.controls.otp.reset('');
  }

  private authSuccess(message: string): void {
    this.toastService.success(message);
    this.router.navigate(['/chat']);
  }

  private showError(error: unknown): void {
    this.toastService.error(this.authService.buildErrorMessage(error));
  }

  private normalizedPhone(): string {
    const phone = this.phoneForm.controls.phoneNumber.value.trim();
    return phone.startsWith('+91') ? phone : `+91${phone}`;
  }

  private startCooldown(cooldown: { set: (value: number) => void; update: (fn: (value: number) => number) => void }): void {
    cooldown.set(60);
    const interval = window.setInterval(() => {
      cooldown.update(value => {
        if (value <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }
}
