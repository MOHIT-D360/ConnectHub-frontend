import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import {
  ApiResponse,
  AuthResponse,
  OAuthCallbackRequest,
  RegisterRequest,
  User
} from '../models/auth.models';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly apiUrl = 'http://localhost:8080';
  private refreshInFlight?: Observable<AuthResponse>;

  private currentUserSignal = signal<User | null>(this.tokenStorage.user());
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal() && !!this.tokenStorage.getAccessToken());
  readonly isAdmin = computed(() => this.currentUserSignal()?.role?.toUpperCase() === 'ADMIN');
  readonly isPro = computed(() => {
    const tier = this.currentUserSignal()?.subscriptionTier || this.currentUserSignal()?.plan;
    return tier?.toUpperCase() === 'PRO';
  });
  readonly isGuest = computed(() => this.currentUserSignal()?.isGuest === true);

  constructor() {
    this.currentUserSignal.set(this.tokenStorage.user());
  }

  register(request: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/register`, request);
  }

  verifyRegistrationOtp(email: string, otp: string): Observable<AuthResponse> {
    return this.postAndStore('/api/v1/auth/verify-registration-otp', { email, otp });
  }

  resendRegistrationOtp(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/resend-registration-otp`, { email });
  }

  loginWithPassword(identifier: string, password: string): Observable<AuthResponse> {
    const key = identifier.includes('@') ? 'email' : 'username';
    return this.postAndStore('/api/v1/auth/login', { [key]: identifier, password });
  }

  login(identifier: string, password: string): Promise<boolean> {
    return new Promise(resolve => {
      this.loginWithPassword(identifier, password).subscribe({
        next: () => resolve(true),
        error: () => resolve(false)
      });
    });
  }

  requestEmailOtp(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/login/email/request-otp`, { email });
  }

  verifyEmailOtp(email: string, otp: string): Observable<AuthResponse> {
    return this.postAndStore('/api/v1/auth/login/email/verify-otp', { email, otp });
  }

  requestPhoneOtp(phoneNumber: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/login/phone/request-otp`, { phoneNumber });
  }

  verifyPhoneOtp(phoneNumber: string, otp: string): Observable<AuthResponse> {
    return this.postAndStore('/api/v1/auth/login/phone/verify-otp', { phoneNumber, otp });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/forgot-password`, { email });
  }

  verifyResetOtp(email: string, otp: string): Observable<string> {
    return this.http
      .post<ApiResponse<string> | string>(`${this.apiUrl}/api/v1/auth/verify-reset-otp`, { email, otp })
      .pipe(map(response => this.unwrapApiString(response)));
  }

  resetPassword(email: string, resetToken: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/reset-password`, {
      email,
      resetToken,
      newPassword
    });
  }

  startOAuth(provider: 'google' | 'github'): void {
    window.location.href = `${this.apiUrl}/oauth2/authorization/${provider}`;
  }

  handleOAuthCallback(provider: 'google' | 'github', request: OAuthCallbackRequest): Observable<AuthResponse> {
    return this.postAndStore(`/api/v1/auth/oauth2/${provider}/callback`, request);
  }

  loginAsGuest(): Observable<AuthResponse> {
    return this.postAndStore('/api/v1/auth/guest', {});
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/v1/auth/logout`, {}).pipe(
      catchError(() => of(void 0)),
      finalize(() => {
        this.tokenStorage.clear();
        this.currentUserSignal.set(null);
        this.router.navigate(['/login']);
      })
    );
  }

  refreshToken(): Observable<AuthResponse> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = this.tokenStorage.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Missing refresh token'));
    }

    this.refreshInFlight = this.http
      .post<AuthResponse>(`${this.apiUrl}/api/v1/auth/refresh`, { refreshToken })
      .pipe(
        tap(response => this.storeAuthResponse(response)),
        finalize(() => (this.refreshInFlight = undefined))
      );

    return this.refreshInFlight;
  }

  validateToken(): Observable<boolean> {
    const accessToken = this.tokenStorage.getAccessToken();
    if (!accessToken) {
      return of(false);
    }

    return this.http
      .get(`${this.apiUrl}/api/v1/auth/validate`, { params: { token: accessToken } })
      .pipe(
        map(() => true),
        catchError(() => of(false))
      );
  }

  getAccessToken(): string | null {
    return this.tokenStorage.getAccessToken();
  }

  getRefreshToken(): string | null {
    return this.tokenStorage.getRefreshToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSignal();
  }

  fetchProfile(userId = this.currentUserSignal()?.id): Observable<User> {
    if (!userId) {
      return throwError(() => new Error('Missing user id'));
    }

    return this.http.get<User | ApiResponse<User>>(`${this.apiUrl}/api/v1/auth/profile/${userId}`).pipe(
      map(response => this.unwrapApiData(response)),
      tap(profile => {
        const user = this.tokenStorage.saveUser(profile as User);
        this.currentUserSignal.set(user);
      })
    );
  }

  updateProfile(request: Partial<Pick<User, 'fullName' | 'username' | 'avatarUrl' | 'bio' | 'phoneNumber'>>): Observable<User> {
    const userId = this.currentUserSignal()?.id;
    if (!userId) {
      return throwError(() => new Error('Missing user id'));
    }

    return this.http.put<User | ApiResponse<User>>(`${this.apiUrl}/api/v1/auth/profile/${userId}`, request).pipe(
      map(response => this.unwrapApiData(response)),
      tap(profile => {
        const user = this.tokenStorage.saveUser(profile as User);
        this.currentUserSignal.set(user);
      })
    );
  }

  updateSubscriptionTier(subscriptionTier: string): void {
    const current = this.currentUserSignal();
    if (!current) {
      return;
    }

    const user = this.tokenStorage.saveUser({
      ...current,
      subscriptionTier,
      plan: subscriptionTier
    });
    this.currentUserSignal.set(user);
  }

  setCurrentUser(_username: string): void {
    this.currentUserSignal.set(this.tokenStorage.user());
  }

  isAccessTokenExpired(): boolean {
    return this.tokenStorage.isAccessTokenExpired();
  }

  buildErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Something went wrong. Please try again.';
    }

    const backendMessage = error.error?.message || error.error?.error || error.error?.details;
    if (backendMessage) {
      return Array.isArray(backendMessage) ? backendMessage.join(', ') : String(backendMessage);
    }

    if (error.status === 400) return 'Please check the submitted details.';
    if (error.status === 401) return 'Invalid credentials or session expired.';
    if (error.status === 429) return 'Too many requests. Please wait and try again.';
    if (error.status >= 500) return 'Server error. Please try again shortly.';
    return 'Something went wrong. Please try again.';
  }

  private postAndStore(path: string, body: unknown): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}${path}`, body).pipe(
      tap(response => this.storeAuthResponse(response)),
      switchMap(response => this.fetchProfile(String(response.user.userId)).pipe(
        map(() => response),
        catchError(() => of(response))
      ))
    );
  }

  private storeAuthResponse(response: AuthResponse): void {
    const session = this.tokenStorage.saveAuthResponse(response);
    this.currentUserSignal.set(session.user);
  }

  private unwrapApiString(response: ApiResponse<string> | string): string {
    if (typeof response === 'string') {
      return response;
    }

    return response.data || response.result || response.message || '';
  }

  private unwrapApiData<T>(response: ApiResponse<T> | T): T {
    const wrapped = response as ApiResponse<T>;
    return wrapped?.data || wrapped?.result || response as T;
  }
}
