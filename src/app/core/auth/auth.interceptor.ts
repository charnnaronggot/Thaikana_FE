import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  if (!request.url.startsWith(environment.apiUrl)) return next(request);
  const actor = auth.user()?.id;
  const authenticated = request.clone({
    withCredentials: true,
    setHeaders: auth.token ? { Authorization: 'Bearer ' + auth.token } : {},
  });
  return next(authenticated).pipe(
    catchError((e: unknown) => {
      if (
        !(e instanceof HttpErrorResponse) ||
        e.status !== 401 ||
        request.url.includes('/auth/') ||
        (request.url.endsWith('/action-verifications') && e.error?.code === 'invalid_credentials')
      )
        return throwError(() => e);
      return from(auth.refresh()).pipe(
        switchMap((token) => {
          if (!actor || auth.user()?.id !== actor) {
            const changed = !!actor && !!auth.user();
            if (changed) auth.clear();
            return throwError(
              () =>
                new HttpErrorResponse({
                  status: 401,
                  error: {
                    code: changed ? 'account_changed' : 'session_expired',
                    detail:
                      'บัญชีหรือ Session เปลี่ยนแล้ว กรุณาเข้าระบบด้วยบัญชีเดิมก่อนตรวจคำสั่งนี้',
                  },
                }),
            );
          }
          return next(
            request.clone({
              withCredentials: true,
              setHeaders: { Authorization: 'Bearer ' + token },
            }),
          );
        }),
      );
    }),
  );
};
