import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
export const authInterceptor:HttpInterceptorFn=(request,next)=>{
 const auth=inject(AuthService);
 if(!request.url.startsWith(environment.apiUrl))return next(request);
 const authenticated=request.clone({withCredentials:true,setHeaders:auth.token?{Authorization:'Bearer '+auth.token}:{}});
 return next(authenticated).pipe(catchError((e:unknown)=>{
  if(!(e instanceof HttpErrorResponse)||e.status!==401||request.url.includes('/auth/'))return throwError(()=>e);
  return from(auth.refresh()).pipe(switchMap(token=>next(request.clone({withCredentials:true,setHeaders:{Authorization:'Bearer '+token}}))));
 }));
};
