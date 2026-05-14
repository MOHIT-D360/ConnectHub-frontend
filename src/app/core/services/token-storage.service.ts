import { Injectable, signal } from '@angular/core';
import { AuthResponse, StoredAuthSession, User } from '../models/auth.models';

const ACCESS_TOKEN_KEY = 'connecthub.accessToken';
const REFRESH_TOKEN_KEY = 'connecthub.refreshToken';
const EXPIRES_IN_KEY = 'connecthub.expiresIn';
const EXPIRES_AT_KEY = 'connecthub.expiresAt';
const TOKEN_TYPE_KEY = 'connecthub.tokenType';
const USER_KEY = 'connecthub.user';
const REGISTRATION_EMAIL_KEY = 'connecthub.registrationEmail';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private userSignal = signal<User | null>(this.readUser());

  readonly user = this.userSignal.asReadonly();

  saveAuthResponse(response: AuthResponse): StoredAuthSession {
    const user = this.normalizeUser(response.user);
    const expiresAt = Date.now() + response.expiresIn * 1000;

    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(EXPIRES_IN_KEY, String(response.expiresIn));
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
    localStorage.setItem(TOKEN_TYPE_KEY, response.tokenType || 'Bearer');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.userSignal.set(user);

    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType || 'Bearer',
      expiresIn: response.expiresIn,
      expiresAt,
      user
    };
  }

  saveUser(user: AuthResponse['user'] | User): User {
    const normalized = 'id' in user ? user as User : this.normalizeUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
    this.userSignal.set(normalized);
    return normalized;
  }

  getSession(): StoredAuthSession | null {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    const user = this.userSignal();

    if (!accessToken || !refreshToken || !user) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      tokenType: this.getTokenType(),
      expiresIn: Number(localStorage.getItem(EXPIRES_IN_KEY) || 0),
      expiresAt: Number(localStorage.getItem(EXPIRES_AT_KEY) || 0),
      user
    };
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getTokenType(): string {
    return localStorage.getItem(TOKEN_TYPE_KEY) || 'Bearer';
  }

  isAccessTokenExpired(bufferSeconds = 30): boolean {
    const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
    return !expiresAt || Date.now() >= expiresAt - bufferSeconds * 1000;
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(EXPIRES_IN_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
    localStorage.removeItem(TOKEN_TYPE_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
  }

  saveRegistrationEmail(email: string): void {
    sessionStorage.setItem(REGISTRATION_EMAIL_KEY, email);
  }

  getRegistrationEmail(): string {
    return sessionStorage.getItem(REGISTRATION_EMAIL_KEY) || '';
  }

  clearRegistrationEmail(): void {
    sessionStorage.removeItem(REGISTRATION_EMAIL_KEY);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private normalizeUser(user: AuthResponse['user']): User {
    const role = user.role || 'USER';
    const subscriptionTier = user.subscriptionTier || 'FREE';

    return {
      ...user,
      id: String(user.userId),
      name: user.fullName || user.username,
      avatar: user.avatarUrl,
      plan: subscriptionTier,
      online: true,
      isGuest: role.toUpperCase() === 'GUEST'
    };
  }
}
