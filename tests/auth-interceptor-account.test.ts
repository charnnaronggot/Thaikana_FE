import '@angular/compiler';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/app/core/auth/auth.service';
import { authInterceptor } from '../src/app/core/auth/auth.interceptor';
import { environment } from '../src/environments/environment';
// The interceptor test supplies the auth boundary; its browser-only service
// dependency graph is covered by the real-API browser tests.
vi.mock('../src/app/core/auth/auth.service', () => ({ AuthService: class AuthService {} }));

describe('refresh identity for an in-flight business command', () => {
  it.each(['missing-before-send', 'missing-after-MFA'])(
    'does not replay a mutation with an unidentified actor: %s',
    async (scenario) => {
      let user: { id: string } | null =
        scenario === 'missing-before-send' ? null : { id: 'original-actor' };
      const auth = {
        token: 'old-token',
        user: () => user,
        refresh: async () => {
          user = scenario === 'missing-before-send' ? { id: 'new-actor' } : null;
          return 'refreshed-token';
        },
        clear: vi.fn(),
      };
      const injector = createEnvironmentInjector(
        [{ provide: AuthService, useValue: auth }],
        Injector.create({ providers: [] }) as EnvironmentInjector,
      );
      const requests: HttpRequest<unknown>[] = [];
      try {
        const result = runInInjectionContext(injector, () =>
          authInterceptor(
            new HttpRequest('POST', environment.apiUrl + '/deliveries', { quantity: 2 }),
            (request) => {
              requests.push(request);
              return throwError(() => new HttpErrorResponse({ status: 401 }));
            },
          ),
        );
        await expect(firstValueFrom(result)).rejects.toMatchObject({
          status: 401,
          error: { code: 'session_expired' },
        });
        expect(requests).toHaveLength(1);
      } finally {
        injector.destroy();
      }
    },
  );
  it('does not resend the old body as another account after a shared-cookie refresh', async () => {
    let user: { id: string } | null = { id: 'original-actor' };
    const auth = {
      token: 'old-token',
      user: () => user,
      refresh: async () => {
        user = { id: 'other-actor' };
        return 'other-token';
      },
      clear: vi.fn(() => {
        user = null;
      }),
    };
    const injector = createEnvironmentInjector(
      [{ provide: AuthService, useValue: auth }],
      Injector.create({ providers: [] }) as EnvironmentInjector,
    );
    const requests: HttpRequest<unknown>[] = [];
    try {
      const result = runInInjectionContext(injector, () =>
        authInterceptor(
          new HttpRequest('POST', environment.apiUrl + '/deliveries', { quantity: 2 }),
          (request) => {
            requests.push(request);
            return requests.length === 1
              ? throwError(() => new HttpErrorResponse({ status: 401 }))
              : of(new HttpResponse({ status: 200 }));
          },
        ),
      );
      await expect(firstValueFrom(result)).rejects.toMatchObject({
        status: 401,
        error: { code: 'account_changed' },
      });
      expect(requests).toHaveLength(1);
      expect(auth.clear).toHaveBeenCalledOnce();
    } finally {
      injector.destroy();
    }
  });
  it('retains the same body and idempotency key when refreshing the same actor', async () => {
    const auth = {
      token: 'old-token',
      user: () => ({ id: 'same-actor' }),
      refresh: async () => 'refreshed-token',
      clear: vi.fn(),
    };
    const injector = createEnvironmentInjector(
      [{ provide: AuthService, useValue: auth }],
      Injector.create({ providers: [] }) as EnvironmentInjector,
    );
    const requests: HttpRequest<unknown>[] = [];
    const body = { quantity: 2 };
    try {
      const request = new HttpRequest('POST', environment.apiUrl + '/deliveries', body).clone({
        setHeaders: { 'Idempotency-Key': 'unchanged-key' },
      });
      const result = runInInjectionContext(injector, () =>
        authInterceptor(request, (next) => {
          requests.push(next);
          return requests.length === 1
            ? throwError(() => new HttpErrorResponse({ status: 401 }))
            : of(new HttpResponse({ status: 200 }));
        }),
      );
      await firstValueFrom(result);
      expect(requests).toHaveLength(2);
      expect(requests[1].body).toBe(body);
      expect(requests[1].headers.get('Idempotency-Key')).toBe('unchanged-key');
      expect(requests[1].headers.get('Authorization')).toBe('Bearer refreshed-token');
      expect(auth.clear).not.toHaveBeenCalled();
    } finally {
      injector.destroy();
    }
  });
});
