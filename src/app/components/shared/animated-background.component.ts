import { Component } from '@angular/core';

@Component({
  selector: 'app-animated-background',
  standalone: true,
  template: `
    <div class="animated-bg">
      <div class="aurora-blob aurora-blob-1"></div>
      <div class="aurora-blob aurora-blob-2"></div>
      <div class="aurora-blob aurora-blob-3"></div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class AnimatedBackgroundComponent {}
