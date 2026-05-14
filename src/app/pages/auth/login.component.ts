import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { AnimatedBackgroundComponent } from '../../components/shared/animated-background.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

type LoginMethod = 'email' | 'phone' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AnimatedBackgroundComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="login-container">
      <!-- Logo Section -->
      <div class="logo-section">
        <div class="logo-badge">
          <span class="logo-emoji">💬</span>
        </div>
        <h1 class="logo-text">ConnectHub</h1>
        <p class="logo-tagline">Premium Real-time Communication</p>
      </div>

      <!-- Login Card -->
      <div class="login-card glass-elevated" [@fadeUp]>
        <h2 class="card-title">Welcome Back</h2>
        <p class="card-subtitle">Sign in to your account</p>

        <!-- Tab Selector -->
        <div class="tab-selector">
          <button 
            class="tab" 
            [class.active]="selectedMethod() === 'email'"
            (click)="selectedMethod.set('email')">
            📧 Email OTP
          </button>
          <button 
            class="tab" 
            [class.active]="selectedMethod() === 'phone'"
            (click)="selectedMethod.set('phone')">
            📱 Phone OTP
          </button>
          <button 
            class="tab" 
            [class.active]="selectedMethod() === 'password'"
            (click)="selectedMethod.set('password')">
            🔐 Password
          </button>
        </div>

        <!-- Method-specific Content -->
        @switch (selectedMethod()) {
          @case ('email') {
            <div class="method-content" [@fadeUp]>
              <div class="input-group">
                <label for="email">Email</label>
                <input 
                  id="email"
                  type="email" 
                  [(ngModel)]="email" 
                  placeholder="you&#64;example.com"
                  (keyup.enter)="sendEmailOtp()">
              </div>
              <button class="btn btn-primary" (click)="sendEmailOtp()" [disabled]="isLoading()">
                {{ isLoading() ? 'Sending...' : 'Send Verification Code' }}
              </button>
              @if (emailSent()) {
                <div class="otp-section">
                  <div class="input-group">
                    <label for="otp-email">Verification Code</label>
                    <input 
                      id="otp-email"
                      type="text" 
                      [(ngModel)]="otp" 
                      placeholder="000000"
                      maxlength="6"
                      (keyup.enter)="verifyEmailOtp()">
                  </div>
                  @if (otpCountdown() > 0) {
                    <p class="countdown">Resend in {{ otpCountdown() }}s</p>
                  } @else {
                    <button class="btn-link" (click)="sendEmailOtp()">Resend Code</button>
                  }
                  <button class="btn btn-primary" (click)="verifyEmailOtp()" [disabled]="isLoading()">
                    {{ isLoading() ? 'Verifying...' : 'Verify' }}
                  </button>
                  <button class="btn-link" (click)="emailSent.set(false)">← Use a different email</button>
                </div>
              }
            </div>
          }
          @case ('phone') {
            <div class="method-content" [@fadeUp]>
              <div class="input-group">
                <label for="phone">Phone Number</label>
                <div class="phone-input-group">
                  <span class="phone-prefix">+91</span>
                  <input 
                    id="phone"
                    type="tel" 
                    [(ngModel)]="phone" 
                    placeholder="9876543210"
                    maxlength="10">
                </div>
              </div>
              <button class="btn btn-primary" (click)="sendPhoneOtp()" [disabled]="isLoading()">
                {{ isLoading() ? 'Sending...' : 'Send OTP' }}
              </button>
              @if (phoneSent()) {
                <div class="otp-section">
                  <div class="input-group">
                    <label for="otp-phone">Verification Code</label>
                    <input 
                      id="otp-phone"
                      type="text" 
                      [(ngModel)]="otp" 
                      placeholder="000000"
                      maxlength="6"
                      (keyup.enter)="verifyPhoneOtp()">
                  </div>
                  @if (otpCountdown() > 0) {
                    <p class="countdown">Resend in {{ otpCountdown() }}s</p>
                  } @else {
                    <button class="btn-link" (click)="sendPhoneOtp()">Resend Code</button>
                  }
                  <button class="btn btn-primary" (click)="verifyPhoneOtp()" [disabled]="isLoading()">
                    {{ isLoading() ? 'Verifying...' : 'Verify' }}
                  </button>
                  <button class="btn-link" (click)="phoneSent.set(false)">← Different number</button>
                </div>
              }
            </div>
          }
          @case ('password') {
            <div class="method-content" [@fadeUp]>
              <div class="input-group">
                <label for="username">Username or Email</label>
                <input 
                  id="username"
                  type="text" 
                  [(ngModel)]="username" 
                  placeholder="alexj or alex&#64;example.com"
                  (keyup.enter)="loginWithPassword()">
              </div>
              <div class="input-group">
                <label for="password">Password</label>
                <div class="password-input-group">
                  <input 
                    id="password"
                    [type]="showPassword() ? 'text' : 'password'" 
                    [(ngModel)]="password" 
                    placeholder="••••••••"
                    (keyup.enter)="loginWithPassword()">
                  <button
                    type="button"
                    class="password-toggle"
                    (click)="togglePasswordVisibility()">
                    {{ showPassword() ? '🙈' : '👁' }}
                  </button>
                </div>
              </div>
              <a routerLink="/forgot-password" class="forgot-link">Forgot?</a>
              <button class="btn btn-primary" (click)="loginWithPassword()" [disabled]="isLoading()">
                {{ isLoading() ? 'Signing in...' : 'Sign In' }}
              </button>
            </div>
          }
        }

        <!-- OAuth Section -->
        <div class="oauth-section">
          <div class="divider">
            <span>or continue with</span>
          </div>
          <div class="oauth-buttons">
            <button class="oauth-btn google">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 22.5c-5.8 0-10.5-4.7-10.5-10.5s4.7-10.5 10.5-10.5 10.5 4.7 10.5 10.5-4.7 10.5-10.5 10.5zm3-11h-2.5v2.5h-1v-2.5h-2.5v-1h2.5v-2.5h1v2.5h2.5v1z"/>
              </svg>
              Google
            </button>
            <button class="oauth-btn github">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>
        </div>

        <!-- Guest Button -->
        <button class="btn btn-ghost" (click)="loginAsGuest()">
          Continue as Guest
        </button>

        <!-- Footer Link -->
        <p class="footer-text">
          Don't have an account? <a routerLink="/register" class="link">Create one now</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
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
      animation: fadeUp 0.6s ease-out;
    }

    .logo-badge {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      box-shadow: 0 0 30px rgba(14, 165, 233, 0.5), 0 8px 32px rgba(14, 165, 233, 0.3);
      position: relative;
    }

    .logo-emoji {
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
    }

    .logo-text {
      font-size: 36px;
      font-weight: 800;
      background: linear-gradient(90deg, var(--color-primary-light), var(--color-primary), var(--color-accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
      letter-spacing: -1px;
    }

    .logo-tagline {
      color: var(--color-text-secondary);
      font-size: 14px;
      margin: 0;
    }

    .login-card {
      max-width: 440px;
      width: 100%;
      padding: 40px;
      border-radius: var(--radius-lg);
    }

    .card-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--color-text-primary);
    }

    .card-subtitle {
      color: var(--color-text-muted);
      margin-bottom: 24px;
      font-size: 14px;
    }

    .tab-selector {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 24px;
    }

    .tab {
      background: transparent;
      border: 1px solid var(--color-glass-border);
      color: var(--color-text-secondary);
      padding: 10px 12px;
      border-radius: var(--radius-md);
      font-size: 12px;
      font-weight: 500;
      transition: all var(--transition-base);
      cursor: pointer;
    }

    .tab:hover {
      background: var(--color-glass-light);
      color: var(--color-text-primary);
    }

    .tab.active {
      background: var(--color-glass-light);
      color: var(--color-primary);
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
    }

    .method-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .input-group label {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input-group input {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
      transition: all var(--transition-base);
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

    .phone-input-group {
      display: flex;
      gap: 8px;
    }

    .phone-prefix {
      display: flex;
      align-items: center;
      padding: 0 12px;
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-md);
      color: var(--color-text-secondary);
      font-weight: 500;
      white-space: nowrap;
    }

    .phone-input-group input {
      flex: 1;
    }

    .forgot-link {
      text-align: right;
      color: var(--color-primary);
      font-size: 13px;
      text-decoration: none;
      transition: color var(--transition-base);
    }

    .forgot-link:hover {
      color: #9f7aea;
    }

    .btn {
      padding: 12px 24px;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 600;
      transition: all var(--transition-base);
      cursor: pointer;
      border: none;
      width: 100%;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
      color: white;
      box-shadow: 0 4px 20px rgba(14, 165, 233, 0.35), 0 0 40px rgba(14, 165, 233, 0.15);
      font-weight: 600;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(14, 165, 233, 0.5), 0 0 60px rgba(14, 165, 233, 0.25);
    }

    .btn-primary:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-ghost {
      background: transparent;
      border: 2px dashed var(--color-glass-border);
      color: var(--color-text-secondary);
    }

    .btn-ghost:hover {
      background: var(--color-glass-light);
      color: var(--color-text-primary);
    }

    .btn-link {
      background: none;
      color: var(--color-primary);
      font-size: 13px;
      padding: 8px 0;
      text-align: center;
      transition: color var(--transition-base);
    }

    .btn-link:hover {
      color: #9f7aea;
    }

    .countdown {
      font-size: 13px;
      color: var(--color-text-muted);
      text-align: center;
      margin: 0;
    }

    .otp-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: rgba(124, 58, 237, 0.1);
      border: 1px solid rgba(124, 58, 237, 0.2);
      border-radius: var(--radius-md);
    }

    .oauth-section {
      margin: 24px 0;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-glass-border);
    }

    .oauth-buttons {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .oauth-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--color-glass-light);
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 500;
      transition: all var(--transition-base);
    }

    .oauth-btn:hover {
      background: var(--color-glass-elevated);
      transform: translateY(-2px);
    }

    .oauth-btn.google {
      color: #4f46e5;
    }

    .oauth-btn.github {
      color: #e8e8e8;
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
      transition: color var(--transition-base);
    }

    .link:hover {
      color: #9f7aea;
    }

    @media (max-width: 480px) {
      .logo-section {
        margin-bottom: 32px;
      }

      .logo-badge {
        width: 64px;
        height: 64px;
        font-size: 32px;
      }

      .logo-text {
        font-size: 28px;
      }

      .login-card {
        padding: 24px;
      }

      .tab-selector {
        grid-template-columns: 1fr;
      }

      .oauth-buttons {
        flex-direction: column;
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
export class LoginComponent {
  selectedMethod = signal<LoginMethod>('password');
  email = '';
  phone = '';
  username = '';
  password = '';
  otp = '';
  showPassword = signal(false);
  isLoading = signal(false);
  emailSent = signal(false);
  phoneSent = signal(false);
  otpCountdown = signal(0);

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  sendEmailOtp(): void {
    if (!this.email) {
      this.toastService.error('Please enter your email');
      return;
    }
    this.isLoading.set(true);
    setTimeout(() => {
      this.emailSent.set(true);
      this.isLoading.set(false);
      this.startOtpCountdown();
      this.toastService.success('OTP sent to your email');
    }, 500);
  }

  verifyEmailOtp(): void {
    if (this.otp !== '123456') {
      this.toastService.error('Invalid OTP');
      return;
    }
    this.loginSuccess();
  }

  sendPhoneOtp(): void {
    if (!this.phone || this.phone.length < 10) {
      this.toastService.error('Please enter a valid phone number');
      return;
    }
    this.isLoading.set(true);
    setTimeout(() => {
      this.phoneSent.set(true);
      this.isLoading.set(false);
      this.startOtpCountdown();
      this.toastService.success('OTP sent to your phone');
    }, 500);
  }

  verifyPhoneOtp(): void {
    if (this.otp !== '123456') {
      this.toastService.error('Invalid OTP');
      return;
    }
    this.loginSuccess();
  }

  async loginWithPassword(): Promise<void> {
    if (!this.username || !this.password) {
      this.toastService.error('Please enter username and password');
      return;
    }
    this.isLoading.set(true);
    const success = await this.authService.login(this.username, this.password);
    this.isLoading.set(false);
    
    if (success) {
      this.toastService.success('Welcome back!');
      this.router.navigate(['/chat']);
    } else {
      this.toastService.error('Invalid credentials. Try "alexj" with any password');
    }
  }

  loginAsGuest(): void {
    this.authService.loginAsGuest();
    this.router.navigate(['/chat']);
  }

  private loginSuccess(): void {
    this.authService.setCurrentUser('alexj');
    this.toastService.success('Logged in successfully!');
    this.router.navigate(['/chat']);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  private startOtpCountdown(): void {
    this.otpCountdown.set(60);
    const interval = setInterval(() => {
      this.otpCountdown.update(v => {
        if (v <= 1) {
          clearInterval(interval);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }
}
