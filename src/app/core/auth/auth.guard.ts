import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import {canOpenModule,ModuleKey} from './workspace-policy';
export const authGuard:CanActivateFn=async(route,state)=>{const auth=inject(AuthService),router=inject(Router);await auth.initialize();const u=auth.user();if(!u)return router.createUrlTree(['/login'],{queryParams:{returnUrl:state.url}});if(u.mustChangePassword&&state.url!=='/change-password')return router.createUrlTree(['/change-password']);const module=route.data['moduleKey'] as ModuleKey|undefined;if(auth.fullWorkspace&&module&&!canOpenModule(u,module))return router.createUrlTree(['/denied']);const p=route.data['permissions'] as string[]|undefined;if(p&&!auth.hasAny(p))return router.createUrlTree(['/denied']);return true;};
export const homeGuard:CanActivateFn=()=>inject(Router).createUrlTree([inject(AuthService).homePath()]);
