import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
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
    path: 'planning',
    canActivate: [authGuard],
    loadComponent: () => import('./features/planning/planning').then((m) => m.Planning),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadComponent: () => import('./features/inventory/inventory').then((m) => m.Inventory),
  },
  {
    path: 'production',
    canActivate: [authGuard],
    loadComponent: () => import('./features/production/production').then((m) => m.Production),
  },
  {
    path: 'station',
    canActivate: [authGuard],
    data: { station: true },
    loadComponent: () => import('./features/production/production').then((m) => m.Production),
  },
  {
    path: 'qc',
    canActivate: [authGuard],
    loadComponent: () => import('./features/qc/qc').then((m) => m.Qc),
  },
  {
    path: 'delivery',
    canActivate: [authGuard],
    loadComponent: () => import('./features/delivery/delivery').then((m) => m.Delivery),
  },
  {
    path: 'documents',
    canActivate: [authGuard],
    loadComponent: () => import('./features/documents/documents').then((m) => m.Documents),
  },
  {
    path: '**',
    canActivate: [authGuard],
    loadComponent: () => import('./features/welcome').then((m) => m.Welcome),
  },
];
