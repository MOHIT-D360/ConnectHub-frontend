import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const withAuth = (request: HttpRequest<unknown>, token: string | null) => {
    if (!token || request.url.includes('/api/v1/auth/refresh')) {
      return request;
    }

    return request.clone({
      setHeaders: {
        Authorization: `${tokenStorage.getTokenType()} ${token}`
      }
    });
  };

  const isBackendRequest = req.url.startsWith(environment.apiBaseUrl) || req.url.startsWith('/api/');
  if (
    isBackendRequest &&
    !req.url.includes('/api/v1/auth/refresh') &&
    tokenStorage.getRefreshToken() &&
    tokenStorage.isAccessTokenExpired()
  ) {
    return authService.refreshToken().pipe(
      switchMap(response => next(withAuth(req, response.accessToken))),
      catchError(refreshError => {
        tokenStorage.clear();
        router.navigate(['/login']);
        return throwError(() => refreshError);
      })
    );
  }

  const request = isBackendRequest ? withAuth(req, tokenStorage.getAccessToken()) : req;

  return next(request).pipe(
    catchError(error => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || req.url.includes('/api/v1/auth/refresh')) {
        return throwError(() => error);
      }

      if (!tokenStorage.getRefreshToken()) {
        tokenStorage.clear();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      return authService.refreshToken().pipe(
        switchMap(response => next(withAuth(req, response.accessToken))),
        catchError(refreshError => {
          tokenStorage.clear();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
