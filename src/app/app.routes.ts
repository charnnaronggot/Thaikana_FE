import { Routes } from '@angular/router';
import { authGuard,homeGuard } from './core/auth/auth.guard';
import { Shell } from './core/layout/shell';
import {environment} from '../environments/environment';
import {workspaceModules} from './core/auth/workspace-policy';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'verify-mfa', loadComponent: () => import('./features/auth/mfa.component').then(m => m.MfaComponent) },
  { path: 'change-password', canActivate: [authGuard], loadComponent: () => import('./features/auth/change-password.component').then(m => m.ChangePasswordComponent) },
  { path: '', component: Shell, canActivate: [authGuard], children: [
    ...(environment.fullWorkspace?[
      {path:'',pathMatch:'full' as const,canActivate:[homeGuard],loadComponent:()=>import('./features/modules/native-workspace.component').then(m=>m.NativeWorkspace)},
      {path:'workspace',loadComponent:()=>import('./features/modules/native-workspace.component').then(m=>m.NativeWorkspace)},
      {path:'design',canActivate:[authGuard],canDeactivate:[(c:any)=>c.canLeave()],data:{moduleKey:'design'},loadComponent:()=>import('./features/design/pages/design-workspace.component').then(m=>m.DesignWorkspace)},
      {path:'design/revisions/:id',canActivate:[authGuard],canDeactivate:[(c:any)=>c.canLeave()],data:{moduleKey:'design'},loadComponent:()=>import('./features/design/pages/design-workspace.component').then(m=>m.DesignWorkspace)},
      {path:'users',canActivate:[authGuard],canDeactivate:[(c:any)=>c.canLeave()],data:{moduleKey:'users'},loadComponent:()=>import('./features/users/pages/users-workspace.component').then(m=>m.UsersWorkspace)},
      ...workspaceModules.filter(m=>!['sales','customers','settings','design','users'].includes(m.key)).map(m=>({path:m.path.slice(1),canActivate:[authGuard],canDeactivate:[(c:any)=>c.canLeave()],data:{moduleKey:m.key},loadComponent:()=>import('./features/modules/native-workspace.component').then(m=>m.NativeWorkspace)})),
    ]:[{ path: '', pathMatch: 'full' as const, redirectTo: 'sales' }]),
    { path: 'sales', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { moduleKey:'sales', feature: 'sales', permissions: ['quotation.view'] }, loadComponent: () => import('./features/runtime/workspace.component').then(m => m.WorkspaceComponent) },
    { path: 'sales/:id', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { moduleKey:'sales', feature: 'sales', permissions: ['quotation.view'] }, loadComponent: () => import('./features/runtime/workspace.component').then(m => m.WorkspaceComponent) },
    { path: 'customers', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { moduleKey:'customers', permissions: ['customer.view'] }, loadComponent: () => import('./features/customers/pages/customers.component').then(m => m.CustomersComponent) },
    { path: 'settings', canActivate: [authGuard], canDeactivate: [c => c.canLeave()], data: { permissions: ['settings.manage'] }, loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
    { path: 'denied', loadComponent: () => import('./features/auth/denied.component').then(m => m.DeniedComponent) },
    { path: '**', redirectTo: 'denied' },
  ] },
];
