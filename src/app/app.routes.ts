import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '**', loadComponent: () => import('./features/welcome').then((m) => m.Welcome) },
];
