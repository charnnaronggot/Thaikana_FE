import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { Shell } from './core/layout/shell';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'change-password', canActivate: [authGuard], loadComponent: () => import('./features/auth/change-password.component').then(m => m.ChangePasswordComponent) },
  { path: '', component: Shell, canActivate: [authGuard], children: [
    { path: '', pathMatch: 'full', redirectTo: 'sales' },
    { path: 'sales', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { feature: 'sales', permissions: ['quotation.view'] }, loadComponent: () => import('./features/runtime/workspace.component').then(m => m.WorkspaceComponent) },
    { path: 'sales/:id', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { feature: 'sales', permissions: ['quotation.view'] }, loadComponent: () => import('./features/runtime/workspace.component').then(m => m.WorkspaceComponent) },
    { path: 'customers', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { permissions: ['customer.view'] }, loadComponent: () => import('./features/customers/pages/customers.component').then(m => m.CustomersComponent) },
    { path: 'settings', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { permissions: ['settings.manage'] }, loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
    { path: 'denied', loadComponent: () => import('./features/auth/denied.component').then(m => m.DeniedComponent) },
    { path: '**', redirectTo: 'denied' },
  ] },
];
