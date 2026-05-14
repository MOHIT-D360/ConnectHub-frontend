import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { finalize } from 'rxjs';
import { AnimatedBackgroundComponent } from '../../../components/shared/animated-background.component';
import { BrandLogoComponent } from '../../../components/shared/brand-logo.component';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { TokenStorageService } from '../../../core/services/token-storage.service';
import { AUTH_UI_STYLES } from '../shared/auth-ui.styles';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, AnimatedBackgroundComponent, BrandLogoComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="auth-container">
      <div class="logo-section">
        <app-brand-logo class="logo-badge"></app-brand-logo>
        <h1 class="logo-text">ConnectHub</h1>
        <p class="logo-tagline">Join the premium messaging experience</p>
      </div>

      <div class="auth-card glass-elevated" [@fadeUp]>
        <h2 class="card-title">Create Account</h2>

        <form class="form-stack" [formGroup]="form" (ngSubmit)="register()">
          <div class="input-group">
            <label for="fullName">Full Name</label>
            <input id="fullName" type="text" formControlName="fullName" placeholder="John Doe">
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label for="username">Username</label>
              <input id="username" type="text" formControlName="username" placeholder="johndoe">
            </div>
            <div class="input-group">
              <label for="phoneNumber">Phone Number</label>
              <input id="phoneNumber" type="tel" formControlName="phoneNumber" placeholder="+919876543210">
            </div>
          </div>

          <div class="input-group">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" placeholder="john@example.com">
          </div>

          <div class="input-group">
            <label for="password">Password</label>
            <div class="password-input-group">
              <input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="Password">
              <button type="button" class="password-toggle" (click)="togglePasswordVisibility()">
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
            <div class="strength-bars">
              @for (item of [1, 2, 3, 4]; track item) {
                <div class="strength-bar" [class.filled]="passwordStrength() >= item"></div>
              }
            </div>
            <p class="countdown">{{ strengthLabel() }}</p>
          </div>

          <div class="input-group">
            <label for="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" type="password" formControlName="confirmPassword" placeholder="Confirm password">
            @if (submitted() && form.errors?.['passwordMismatch']) {
              <span class="input-error">Passwords do not match.</span>
            }
          </div>

          @if (submitted() && form.controls.password.errors?.['passwordPolicy']) {
            <span class="input-error">
              Password must be 8-72 characters and include uppercase, lowercase, number, and special character.
            </span>
          }

          <button class="btn btn-primary" type="submit" [disabled]="isLoading()">
            {{ isLoading() ? 'Creating Account...' : 'Create Account' }}
          </button>
        </form>

        <p class="terms-text" style="margin-top: 16px;">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>

        <p class="footer-text" style="margin-top: 18px;">
          Already have an account? <a routerLink="/login" class="link">Sign in</a>
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
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  isLoading = signal(false);
  submitted = signal(false);
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^(\+91)?[6-9]\d{9}$/)]],
    password: ['', [Validators.required, passwordPolicyValidator]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordMatchValidator });

  passwordStrength = computed(() => {
    const password = this.form.controls.password.value;
    let strength = 0;
    if (password.length >= 8 && password.length <= 72) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  });

  strengthLabel(): string {
    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[this.passwordStrength()];
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  register(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.toastService.error('Please correct the highlighted fields.');
      return;
    }

    this.isLoading.set(true);
    const value = this.form.getRawValue();
    const email = value.email.trim();
    this.authService.register({
      fullName: value.fullName.trim(),
      username: value.username.trim(),
      email,
      phoneNumber: normalizePhone(value.phoneNumber),
      password: value.password
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.tokenStorage.saveRegistrationEmail(email);
        this.toastService.success('Registration successful. Please verify your email.');
        this.router.navigate(['/verify-email'], { queryParams: { email, otpSent: 'true' } });
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
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

function normalizePhone(phone: string): string {
  return phone.startsWith('+91') ? phone : `+91${phone}`;
}
