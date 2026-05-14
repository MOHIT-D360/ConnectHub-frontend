import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toasts(); track toast.id) {
        <div 
          class="toast glass-elevated" 
          [class]="'toast-' + toast.type"
          [@slideRight]
          (@slideRight.done)="removeToast(toast.id)">
          <div class="toast-content">
            <div class="toast-icon">
              @switch (toast.type) {
                @case ('success') {
                  <span>✓</span>
                }
                @case ('error') {
                  <span>✕</span>
                }
                @case ('warning') {
                  <span>⚠</span>
                }
                @default {
                  <span>ℹ</span>
                }
              }
            </div>
            <p class="toast-message">{{ toast.message }}</p>
          </div>
          <button class="toast-close" (click)="removeToast(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      z-index: 9999;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      border-left: 3px solid;
      pointer-events: auto;
      min-width: 300px;
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .toast-icon {
      font-size: 18px;
      font-weight: 700;
      min-width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toast-message {
      font-size: 14px;
      margin: 0;
    }

    .toast-success {
      border-left-color: var(--color-success);
      background: rgba(16, 185, 129, 0.1) !important;
    }

    .toast-success .toast-icon {
      color: var(--color-success);
    }

    .toast-error {
      border-left-color: var(--color-danger);
      background: rgba(239, 68, 68, 0.1) !important;
    }

    .toast-error .toast-icon {
      color: var(--color-danger);
    }

    .toast-warning {
      border-left-color: var(--color-warning);
      background: rgba(245, 158, 11, 0.1) !important;
    }

    .toast-warning .toast-icon {
      color: var(--color-warning);
    }

    .toast-info {
      border-left-color: var(--color-primary);
      background: rgba(124, 58, 237, 0.1) !important;
    }

    .toast-info .toast-icon {
      color: var(--color-primary);
    }

    .toast-close {
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      min-width: auto;
      transition: color var(--transition-base);
    }

    .toast-close:hover {
      color: var(--color-text-secondary);
    }

    @media (max-width: 480px) {
      .toast-container {
        bottom: 16px;
        right: 16px;
        left: 16px;
      }

      .toast {
        min-width: unset;
      }
    }
  `],
  animations: [
    trigger('slideRight', [
      transition(':enter', [
        style({ transform: 'translateX(110%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateX(110%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ToastComponent {
  private toastService = inject(ToastService);
  toasts: any;

  constructor() {
    this.toasts = this.toastService.toasts;
  }

  removeToast(id: string): void {
    this.toastService.dismiss(id);
  }
}
