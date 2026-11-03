import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthResponse, UserProfile, MfaPending, MfaEnrollment } from '../models/api.models';
import { environment } from '../../../environments/environment';
import { encryptLogin, LoginChallenge } from './login-encryption';
import { homeFor, safeDestination } from './workspace-policy';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = new HttpClient(inject(HttpBackend));
  readonly user = signal<UserProfile | null>(null);
  readonly pendingMfa = signal<MfaPending | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  private accessToken = '';
  private initialized?: Promise<void>;
  private refreshPromise?: Promise<string>;
  get token() {
    return this.accessToken;
  }
  readonly fullWorkspace = environment.fullWorkspace;
  homePath() {
    return this.fullWorkspace
      ? homeFor(this.user())
      : this.user()?.accountType === 'Station'
        ? '/denied'
        : this.has('quotation.view')
          ? '/sales'
          : this.has('customer.view')
            ? '/customers'
            : this.has('settings.manage')
              ? '/settings'
              : '/denied';
  }
  destination(returnUrl: string | null) {
    return this.fullWorkspace
      ? safeDestination(this.user(), returnUrl)
      : this.user()?.accountType === 'Station'
        ? '/denied'
        : returnUrl && /^\/(sales|customers|settings|denied)(\/|\?|$)/.test(returnUrl)
          ? returnUrl
          : this.homePath();
  }
  has(permission: string) {
    const aliases: Record<string, string> = {
      'quotation.view': 'business.view',
      'quotation.manage': 'sales.manage',
      'quotation.send': 'sales.manage',
      'quotation.accept': 'sales.manage',
      'sales_order.view': 'business.view',
      'sales_order.manage': 'sales.manage',
      'customer.view': 'master.view',
      'product_revision.view': 'master.view',
      'settings.manage': 'user.manage',
    };
    return !!this.user()?.permissions?.includes(aliases[permission] ?? permission);
  }
  hasAny(permissions: string[]) {
    return permissions.length === 0 || permissions.some((p) => this.has(p));
  }
  private accept(response: AuthResponse) {
    const user: UserProfile = {
      ...response.user,
      accountType: String(response.user.accountType) === 'STATION' ? 'Station' : 'Personal',
    };
    this.pendingMfa.set(response.mfa ?? null);
    this.recoveryCodes.set(response.recoveryCodes ?? []);
    this.accessToken = response.mfa ? '' : response.accessToken;
    this.user.set(response.mfa ? null : user);
    return user;
  }
  initialize() {
    return (this.initialized ??= this.refresh()
      .then(() => undefined)
      .catch(() => {
        this.clear();
      }));
  }
  async login(username: string, password: string) {
    const challenge = await firstValueFrom(
      this.http.get<LoginChallenge>(environment.apiUrl + '/auth/login-challenge'),
    );
    const encrypted = await encryptLogin(challenge, username, password);
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(environment.apiUrl + '/auth/login/encrypted', encrypted, {
        withCredentials: true,
      }),
    );
    return this.accept(response);
  }
  async enrollMfa() {
    const pending = this.pendingMfa();
    if (!pending) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    return firstValueFrom(
      this.http.post<MfaEnrollment>(
        environment.apiUrl + '/auth/mfa/enrollment',
        { challengeToken: pending.challengeToken },
        { withCredentials: true, headers: { 'X-Thaikana-CSRF': '1' } },
      ),
    );
  }
  async verifyMfa(code: string, recoveryCode: boolean) {
    const pending = this.pendingMfa();
    if (!pending) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(
        environment.apiUrl + '/auth/mfa/verify',
        { challengeToken: pending.challengeToken, code, recoveryCode },
        { withCredentials: true, headers: { 'X-Thaikana-CSRF': '1' } },
      ),
    );
    return this.accept(response);
  }
  async changePassword(currentPassword: string, newPassword: string) {
    return this.accept(
      await firstValueFrom(
        this.http.post<AuthResponse>(
          environment.apiUrl + '/auth/change-password',
          { currentPassword, newPassword },
          { withCredentials: true, headers: { Authorization: 'Bearer ' + this.accessToken } },
        ),
      ),
    );
  }
  refresh() {
    if (!this.refreshPromise)
      this.refreshPromise = firstValueFrom(
        this.http.post<AuthResponse>(
          environment.apiUrl + '/auth/refresh',
          {},
          { withCredentials: true, headers: { 'X-Thaikana-CSRF': '1' } },
        ),
      )
        .then((r) => {
          this.accept(r);
          return r.accessToken;
        })
        .catch((e) => {
          this.clear();
          throw e;
        })
        .finally(() => {
          this.refreshPromise = undefined;
        });
    return this.refreshPromise;
  }
  async logout() {
    try {
      await firstValueFrom(
        this.http.post(
          environment.apiUrl + '/auth/logout',
          {},
          { withCredentials: true, headers: { 'X-Thaikana-CSRF': '1' } },
        ),
      );
    } finally {
      this.clear();
    }
  }
  clear() {
    this.accessToken = '';
    this.user.set(null);
    this.pendingMfa.set(null);
    this.recoveryCodes.set([]);
  }
}
