import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

@Injectable({ providedIn: 'root' })
export class PushTokenService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiBaseUrl}${environment.notifications.baseUrl}`;

  // Firebase config from environment
  private readonly firebaseConfig = environment.firebase;

  init(): void {
    // Only attempt for logged-in users.
    const user = this.auth.getCurrentUser();
    if (!user?.id) return;

    this.registerIfPossible().subscribe({ error: () => undefined });
  }

  private registerIfPossible() {
    return of(null).pipe(
      switchMap(() => isSupported()),
      switchMap(supported => {
        if (!supported) return of(null);

        if (!this.isConfigured()) return of(null);

        return this.requestPermissionIfNeeded().pipe(
          switchMap(granted => granted ? this.fetchAndRegisterToken() : of(null))
        );
      }),
      catchError(() => of(null))
    );
  }

  private isConfigured(): boolean {
    const cfg = this.firebaseConfig;
    return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.messagingSenderId && cfg.appId && cfg.vapidKey);
  }

  private requestPermissionIfNeeded() {
    if (typeof Notification === 'undefined') return of(false);
    if (Notification.permission === 'granted') return of(true);
    if (Notification.permission === 'denied') return of(false);
    return of(null).pipe(
      switchMap(() => Notification.requestPermission()),
      switchMap(result => of(result === 'granted')),
      catchError(() => of(false))
    );
  }

  private fetchAndRegisterToken() {
    const app = initializeApp({
      apiKey: this.firebaseConfig.apiKey,
      authDomain: this.firebaseConfig.authDomain,
      projectId: this.firebaseConfig.projectId,
      messagingSenderId: this.firebaseConfig.messagingSenderId,
      appId: this.firebaseConfig.appId
    });

    return of(null).pipe(
      switchMap(async () => {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: this.firebaseConfig.vapidKey, serviceWorkerRegistration: registration });
        return token;
      }),
      switchMap(token => token
        ? this.http.post(`${this.apiUrl}${environment.notifications.devicesEndpoint}`, { token, platform: 'WEB' })
        : of(null)
      ),
      tap(() => undefined),
      catchError(() => of(null))
    );
  }
}

