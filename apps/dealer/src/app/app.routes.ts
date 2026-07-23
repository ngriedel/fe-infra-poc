import { Route } from '@angular/router';
import { requireAuth } from '@aic/shared/auth';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login-page.component').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [requireAuth],
    loadComponent: () => import('./home/home-page.component').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
