import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/users').then((m) => m.Users),
  },
  {
    path: 'sales',
    canActivate: [authGuard],
    loadComponent: () => import('./features/sales/sales').then((m) => m.Sales),
  },
  {
    path: 'sales/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/sales/sales').then((m) => m.Sales),
  },
  {
    path: 'design',
    canActivate: [authGuard],
    loadComponent: () => import('./features/design/design').then((m) => m.Design),
  },
  {
    path: '**',
    canActivate: [authGuard],
    loadComponent: () => import('./features/welcome').then((m) => m.Welcome),
  },
];
