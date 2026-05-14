import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSignal = signal<'dark' | 'light'>('dark');
  public theme = this.themeSignal.asReadonly();

  constructor() {
    // Load theme from localStorage
    const saved = localStorage.getItem('theme');
    if (saved) {
      this.themeSignal.set(saved as 'dark' | 'light');
    }

    // Apply theme changes
    effect(() => {
      const theme = this.themeSignal();
      document.documentElement.dataset['theme'] = theme;
      localStorage.setItem('theme', theme);
    });
  }

  toggle(): void {
    this.themeSignal.update(theme => theme === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.themeSignal.set(theme);
  }

  isDark(): boolean {
    return this.themeSignal() === 'dark';
  }
}
