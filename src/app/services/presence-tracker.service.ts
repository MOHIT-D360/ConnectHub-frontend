import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PresenceTrackerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/presence';
  private currentUserId?: string;
  private pingTimer?: number;
  private visibilityHandler?: () => void;
  private unloadHandler?: () => void;

  start(userId: string): void {
    if (!userId) {
      return;
    }
    if (this.currentUserId === userId && this.pingTimer) {
      return;
    }
    if (this.currentUserId && this.currentUserId !== userId) {
      this.stop();
    }

    this.currentUserId = userId;
    this.markOnline();
    this.startPing();
    this.bindBrowserEvents();
  }

  stop(): void {
    this.markOffline();
    this.currentUserId = undefined;
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = undefined;
    }
  }

  private startPing(): void {
    this.pingTimer = window.setInterval(() => this.ping(), 30000);
  }

  private bindBrowserEvents(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.markOnline();
      } else {
        this.ping();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.unloadHandler = () => {
      if (!this.currentUserId) return;
      this.http.post(`${this.apiUrl}/offline/${encodeURIComponent(this.currentUserId)}`, {}).subscribe({ error: () => undefined });
    };
    window.addEventListener('beforeunload', this.unloadHandler);
  }

  private markOnline(): void {
    if (!this.currentUserId) return;
    this.http.post(`${this.apiUrl}/online/${encodeURIComponent(this.currentUserId)}`, {
      deviceType: 'WEB',
      sessionId: `web-${Date.now()}`
    }).subscribe({ error: () => undefined });
  }

  private ping(): void {
    if (!this.currentUserId) return;
    this.http.post(`${this.apiUrl}/ping/${encodeURIComponent(this.currentUserId)}`, {}).subscribe({ error: () => undefined });
  }

  private markOffline(): void {
    if (!this.currentUserId) return;
    this.http.post(`${this.apiUrl}/offline/${encodeURIComponent(this.currentUserId)}`, {}).subscribe({ error: () => undefined });
  }
}
