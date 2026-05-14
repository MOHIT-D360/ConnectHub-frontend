import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { AnimatedBackgroundComponent } from '../../components/shared/animated-background.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AnimatedBackgroundComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="register-container">
      <div class="logo-section">
        <div class="logo-badge">💬</div>
        <h1 class="logo-text">ConnectHub</h1>
        <p class="logo-tagline">Join the premium messaging experience</p>
      </div>

      <div class="register-card glass-elevated" [@fadeUp]>
        <h2 class="card-title">Create Account</h2>

        <div class="form-group">
          <label for="fullname">Full Name</label>
          <input id="fullname" type="text" [(ngModel)]="formData.fullName" placeholder="John Doe">
        </div>

        <div class="form-group">
          <label for="username">Username</label>
          <input id="username" type="text" [(ngModel)]="formData.username" placeholder="johndoe">
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" [(ngModel)]="formData.email" placeholder="john&#64;example.com">
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="password-input-group">
            <input 
              id="password"
              [type]="showPassword() ? 'text' : 'password'" 
              [(ngModel)]="formData.password" 
              placeholder="••••••••"
              (input)="updatePasswordStrength()">
            <button 
              type="button"
              class="password-toggle" 
              (click)="togglePasswordVisibility()">
              {{ showPassword() ? '🙈' : '👁' }}
            </button>
          </div>
          
          <div class="password-strength">
            @for (i of [1,2,3,4]; track i) {
              <div class="strength-bar" [class.filled]="passwordStrength() >= i"></div>
            }
          </div>
          <p class="strength-text" [class]="'strength-' + strengthLevel()">
            {{ strengthLabel() }}
          </p>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input 
            id="confirmPassword"
            type="password" 
            [(ngModel)]="formData.confirmPassword" 
            placeholder="••••••••">
        </div>

        <button class="btn btn-primary" (click)="register()" [disabled]="isLoading()">
          {{ isLoading() ? 'Creating Account...' : 'Create Account' }}
        </button>

        <p class="terms-text">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>

        <p class="footer-text">
          Already have an account? <a routerLink="/login" class="link">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-md);
      position: relative;
      z-index: 1;
    }

    .logo-section {
      text-align: center;
      margin-bottom: 48px;
    }

    .logo-badge {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      box-shadow: 0 8px 32px rgba(124, 58, 237, 0.4);
    }

    .logo-text {
      font-size: 36px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }

    .logo-tagline {
      color: var(--color-text-secondary);
      font-size: 14px;
      margin: 0;
    }

    .register-card {
      max-width: 440px;
      width: 100%;
      padding: 40px;
      border-radius: var(--radius-lg);
    }

    .card-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 24px;
      color: var(--color-text-primary);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-group input {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
    }

    .password-input-group {
      position: relative;
      display: flex;
    }

    .password-input-group input {
      flex: 1;
    }

    .password-toggle {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      font-size: 18px;
      padding: 0;
    }

    .password-strength {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }

    .strength-bar {
      flex: 1;
      height: 4px;
      background: var(--color-glass-light);
      border-radius: 2px;
      transition: background-color var(--transition-base);
    }

    .strength-bar.filled {
      background: var(--color-success);
    }

    .strength-text {
      font-size: 11px;
      margin: 4px 0 0 0;
      color: var(--color-text-muted);
    }

    .strength-weak {
      color: var(--color-danger);
    }

    .strength-fair {
      color: var(--color-warning);
    }

    .strength-good {
      color: var(--color-success);
    }

    .strength-strong {
      color: var(--color-success);
    }

    .btn {
      padding: 12px 24px;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      width: 100%;
      transition: all var(--transition-base);
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .terms-text {
      text-align: center;
      font-size: 11px;
      color: var(--color-text-muted);
      margin: 16px 0 24px;
    }

    .footer-text {
      text-align: center;
      font-size: 14px;
      color: var(--color-text-muted);
      margin: 0;
    }

    .link {
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
    }

    .link:hover {
      color: #9f7aea;
    }

    @media (max-width: 480px) {
      .register-card {
        padding: 24px;
      }
    }
  `],
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
  formData = {
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  showPassword = signal(false);
  isLoading = signal(false);
  passwordStrength = signal(0);

  constructor(
    private router: Router,
    private toastService: ToastService
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  updatePasswordStrength(): void {
    const pwd = this.formData.password;
    let strength = 0;

    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    this.passwordStrength.set(strength);
  }

  strengthLevel(): string {
    const strength = this.passwordStrength();
    if (strength <= 1) return 'weak';
    if (strength === 2) return 'fair';
    if (strength === 3) return 'good';
    return 'strong';
  }

  strengthLabel(): string {
    return this.strengthLevel().charAt(0).toUpperCase() + this.strengthLevel().slice(1);
  }

  register(): void {
    if (!this.formData.fullName || !this.formData.username || !this.formData.email || !this.formData.password) {
      this.toastService.error('Please fill in all fields');
      return;
    }

    if (this.formData.password !== this.formData.confirmPassword) {
      this.toastService.error('Passwords do not match');
      return;
    }

    if (this.passwordStrength() < 2) {
      this.toastService.error('Password is too weak');
      return;
    }

    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      this.toastService.success('Account created successfully!');
      this.router.navigate(['/login']);
    }, 500);
  }
}
