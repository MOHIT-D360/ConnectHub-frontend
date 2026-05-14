import { Routes } from '@angular/router';
import { adminGuard, authGuard, publicGuard } from './guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { OAuthCallbackComponent } from './features/auth/oauth-callback/oauth-callback.component';
import { ChatLayoutComponent } from './pages/chat/chat-layout.component';
import { PremiumComponent } from './pages/premium/premium.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/chat',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [publicGuard]
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [publicGuard]
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [publicGuard]
  },
  {
    path: 'verify-email',
    component: VerifyEmailComponent,
    canActivate: [publicGuard]
  },
  {
    path: 'oauth-callback',
    component: OAuthCallbackComponent,
    canActivate: [publicGuard]
  },
  {
    path: 'chat',
    component: ChatLayoutComponent,
    canActivate: [authGuard]
  },
  {
    path: 'premium',
    component: PremiumComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [adminGuard]
  },
  {
    path: '**',
    redirectTo: '/chat'
  }
];
