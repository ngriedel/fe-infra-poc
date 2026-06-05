import { Route } from '@angular/router';
import { requireAuth } from './auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login-page.component').then((m) => m.LoginPage),
  },
  {
    // Public demo route — intentionally NOT behind requireAuth.
    path: 'signal-forms',
    loadComponent: () =>
      import('./signal-forms-demo/signal-forms-demo.component').then(
        (m) => m.SignalFormsDemoComponent,
      ),
  },
  {
    path: '',
    canActivate: [requireAuth],
    loadComponent: () => import('./home/home-page.component').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
