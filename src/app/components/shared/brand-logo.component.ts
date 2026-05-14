import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="brand-logo" [class.mark-only]="markOnly()" [class.compact]="compact()">
      <img
        class="brand-image"
        src="/assets/brand/connecthub-logo.svg"
        width="144"
        height="144"
        alt="ConnectHub"
        decoding="async"
        loading="eager">
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      line-height: 0;
    }

    .brand-logo {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 74px;
      height: 74px;
      aspect-ratio: 1;
      flex: 0 0 auto;
      border-radius: 22px;
      overflow: hidden;
      filter: drop-shadow(0 12px 24px rgba(15, 23, 42, 0.16));
    }

    .brand-logo.compact {
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    .brand-logo.mark-only .brand-image {
      transform: scale(1.28);
    }

    .brand-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 180ms ease, transform 220ms ease;
    }
  `]
})
export class BrandLogoComponent {
  readonly compact = input(false);
  readonly markOnly = input(false);
}
