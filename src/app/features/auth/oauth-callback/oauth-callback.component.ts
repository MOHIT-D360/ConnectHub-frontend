import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnimatedBackgroundComponent } from '../../../components/shared/animated-background.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { AUTH_UI_STYLES } from '../shared/auth-ui.styles';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, AnimatedBackgroundComponent],
  template: `
    <app-animated-background></app-animated-background>

    <div class="auth-container">
      <div class="auth-card glass-elevated">
        <h2 class="card-title">Signing You In</h2>
        <p class="card-subtitle">{{ statusMessage() }}</p>
      </div>
    </div>
  `,
  styles: AUTH_UI_STYLES
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  statusMessage = signal('Completing OAuth sign in...');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const provider = (params.get('provider') || params.get('registrationId') || 'google').toLowerCase();
    const code = params.get('code') || undefined;
    const token = params.get('token') || params.get('access_token') || undefined;
    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    if (provider !== 'google' && provider !== 'github') {
      this.statusMessage.set('Unsupported OAuth provider.');
      this.toastService.error('Unsupported OAuth provider.');
      this.router.navigate(['/login']);
      return;
    }

    this.authService.handleOAuthCallback(provider, { code, token, redirectUri }).subscribe({
      next: () => {
        this.toastService.success('Logged in successfully.');
        this.router.navigate(['/chat']);
      },
      error: error => {
        this.statusMessage.set('OAuth sign in failed.');
        this.toastService.error(this.authService.buildErrorMessage(error));
        this.router.navigate(['/login']);
      }
    });
  }
}
