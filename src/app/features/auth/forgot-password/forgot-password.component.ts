import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AnimatedBackgroundComponent } from '../../../components/shared/animated-background.component';
import { BrandLogoComponent } from '../../../components/shared/brand-logo.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { AUTH_UI_STYLES } from '../shared/auth-ui.styles';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AnimatedBackgroundComponent, BrandLogoComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="auth-container">
      <div class="logo-section">
        <app-brand-logo class="logo-badge"></app-brand-logo>
        <h1 class="logo-text">ConnectHub</h1>
        <p class="logo-tagline">Recover access to your account</p>
      </div>

      <div class="auth-card glass-elevated">
        <h2 class="card-title">Reset Password</h2>
        <p class="card-subtitle">{{ subtitle() }}</p>

        <div class="progress">
          @for (item of [1, 2, 3]; track item) {
            <div class="progress-step" [class.active]="step() >= item"></div>
          }
        </div>

        @switch (step()) {
          @case (1) {
            <form class="form-stack" [formGroup]="emailForm" (ngSubmit)="requestResetOtp()">
              <div class="input-group">
                <label for="email">Email</label>
                <input id="email" type="email" formControlName="email" placeholder="you@example.com">
              </div>
              <button class="btn btn-primary" type="submit" [disabled]="isLoading() || emailForm.invalid">
                {{ isLoading() ? 'Sending...' : 'Send Reset Code' }}
              </button>
            </form>
          }

          @case (2) {
            <form class="form-stack" [formGroup]="otpForm" (ngSubmit)="verifyResetOtp()">
              <div class="state-panel">
                <p class="muted-text">Code sent to {{ emailForm.controls.email.value }}</p>
                <div class="input-group">
                  <label for="otp">Reset Code</label>
                  <input id="otp" class="otp-input" type="text" inputmode="numeric" maxlength="6" formControlName="otp" placeholder="000000">
                </div>
              </div>
              <button class="btn btn-primary" type="submit" [disabled]="isLoading() || otpForm.invalid">
                {{ isLoading() ? 'Verifying...' : 'Verify Code' }}
              </button>
              <button type="button" class="btn-link" (click)="step.set(1)">Use different email</button>
            </form>
          }

          @case (3) {
            <form class="form-stack" [formGroup]="passwordForm" (ngSubmit)="resetPassword()">
              <div class="input-group">
                <label for="newPassword">New Password</label>
                <input id="newPassword" type="password" formControlName="newPassword" placeholder="New password">
              </div>
              <div class="input-group">
                <label for="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" formControlName="confirmPassword" placeholder="Confirm password">
                @if (passwordForm.errors?.['passwordMismatch']) {
                  <span class="input-error">Passwords do not match.</span>
                }
              </div>
              @if (passwordForm.controls.newPassword.errors?.['passwordPolicy']) {
                <span class="input-error">
                  Password must be 8-72 characters and include uppercase, lowercase, number, and special character.
                </span>
              }
              <button class="btn btn-primary" type="submit" [disabled]="isLoading() || passwordForm.invalid">
                {{ isLoading() ? 'Resetting...' : 'Reset Password' }}
              </button>
            </form>
          }
        }

        <p class="footer-text" style="margin-top: 18px;">
          Remembered it? <a routerLink="/login" class="link">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: AUTH_UI_STYLES
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  step = signal(1);
  isLoading = signal(false);
  resetToken = signal('');

  emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  passwordForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, passwordPolicyValidator]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordMatchValidator });

  subtitle(): string {
    if (this.step() === 1) return 'Request a password reset code.';
    if (this.step() === 2) return 'Verify the code from your inbox.';
    return 'Choose a new password.';
  }

  requestResetOtp(): void {
    if (this.emailForm.invalid) return;

    this.isLoading.set(true);
    this.authService.forgotPassword(this.emailForm.controls.email.value.trim()).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.toastService.success('Reset code sent to your email.');
        this.step.set(2);
      },
      error: error => this.toastService.error(this.authService.buildErrorMessage(error))
    });
  }

  verifyResetOtp(): void {
    if (this.otpForm.invalid) return;

    this.isLoading.set(true);
    this.authService.verifyResetOtp(this.emailForm.controls.email.value.trim(), this.otpForm.controls.otp.value).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: resetToken => {
        this.resetToken.set(resetToken);
        this.toastService.success('Code verified.');
        this.step.set(3);
      },
      error: error => this.toastService.error(this.authService.buildErrorMessage(error))
    });
  }

  resetPassword(): void {
    if (this.passwordForm.invalid || !this.resetToken()) return;

    this.isLoading.set(true);
    this.authService
      .resetPassword(
        this.emailForm.controls.email.value.trim(),
        this.resetToken(),
        this.passwordForm.controls.newPassword.value
      )
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.toastService.success('Password reset successful. Please sign in.');
          this.router.navigate(['/login']);
        },
        error: error => this.toastService.error(this.authService.buildErrorMessage(error))
      });
  }
}

function passwordPolicyValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value || '');
  const valid =
    value.length >= 8 &&
    value.length <= 72 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^a-zA-Z0-9]/.test(value);

  return valid ? null : { passwordPolicy: true };
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}
