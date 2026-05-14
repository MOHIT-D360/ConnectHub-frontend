export interface BackendUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  avatarUrl: string;
  bio?: string;
  status: string;
  role: string;
  subscriptionTier: string;
}

export interface User extends BackendUser {
  id: string;
  name: string;
  avatar?: string;
  plan: string;
  online: boolean;
  lastSeen?: string;
  isGuest: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: BackendUser;
}

export interface StoredAuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
  user: User;
}

export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  result?: T;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

export interface OAuthCallbackRequest {
  code?: string;
  token?: string;
  redirectUri?: string;
}
