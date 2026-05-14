export const AUTH_UI_STYLES = [`
  .auth-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
    position: relative;
    z-index: 1;
    overflow-y: auto;
  }

  .logo-section {
    text-align: center;
    margin-bottom: 32px;
  }

  .logo-badge {
    width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 30px rgba(14, 165, 233, 0.22);
  }

  .logo-text {
    font-size: 36px;
    font-weight: 800;
    background: linear-gradient(90deg, var(--color-primary-light), var(--color-primary), var(--color-accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
    letter-spacing: 0;
  }

  .logo-tagline,
  .card-subtitle,
  .muted-text {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0;
  }

  .auth-card {
    max-width: 460px;
    width: 100%;
    padding: 36px;
    border-radius: var(--radius-lg);
  }

  .card-title {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--color-text-primary);
    letter-spacing: 0;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 24px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    width: 100%;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 14px;
  }

  .input-error {
    color: var(--color-danger);
    font-size: 12px;
  }

  .tab-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 24px 0;
  }

  .tab {
    background: transparent;
    border: 1px solid var(--color-glass-border);
    color: var(--color-text-secondary);
    padding: 10px 12px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 500;
  }

  .tab.active {
    background: var(--color-glass-light);
    color: var(--color-primary);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
  }

  .btn {
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 600;
    width: 100%;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
    color: white;
    box-shadow: 0 4px 20px rgba(14, 165, 233, 0.25);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(14, 165, 233, 0.4);
  }

  .btn-ghost {
    background: transparent;
    border: 2px dashed var(--color-glass-border);
    color: var(--color-text-secondary);
  }

  .btn-link {
    background: none;
    color: var(--color-primary);
    font-size: 13px;
    padding: 8px 0;
    text-align: center;
    width: auto;
  }

  .password-input-group,
  .phone-input-group {
    display: flex;
    gap: 8px;
    position: relative;
  }

  .password-input-group input,
  .phone-input-group input {
    flex: 1;
  }

  .password-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    color: var(--color-text-secondary);
    padding: 0;
    width: auto;
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
  }

  .otp-input {
    font-family: var(--font-mono);
    text-align: center;
    letter-spacing: 8px;
    font-size: 20px !important;
  }

  .otp-section,
  .state-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(14, 165, 233, 0.08);
    border: 1px solid rgba(14, 165, 233, 0.22);
    border-radius: var(--radius-md);
  }

  .countdown,
  .footer-text,
  .terms-text {
    text-align: center;
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0;
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
  }

  .oauth-btn {
    flex: 1;
    padding: 12px 16px;
    background: var(--color-glass-light);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: 13px;
    font-weight: 500;
  }

  .link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 600;
  }

  .strength-bars {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }

  .strength-bar {
    flex: 1;
    height: 4px;
    background: var(--color-glass-light);
    border-radius: 2px;
  }

  .strength-bar.filled {
    background: var(--color-success);
  }

  .progress {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 24px;
  }

  .progress-step {
    height: 4px;
    border-radius: 4px;
    background: var(--color-glass-light);
  }

  .progress-step.active {
    background: var(--color-primary);
  }

  @media (max-width: 520px) {
    .auth-card {
      padding: 24px;
    }

    .tab-selector,
    .form-grid {
      grid-template-columns: 1fr;
    }

    .oauth-buttons {
      flex-direction: column;
    }
  }
`];
