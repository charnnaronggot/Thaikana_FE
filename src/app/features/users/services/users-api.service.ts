import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../../core/services/api/api-client.service';
import { Page } from '../../../core/models/api.models';
import { ManagedUser, MfaStatus, UserDetail, UserOptions } from '../models/user.models';
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private api = inject(ApiClient);
  list(query: Record<string, string | number | boolean | undefined>) {
    return this.api.get<Page<ManagedUser>>('/users', query);
  }
  options() {
    return this.api.get<UserOptions>('/users/options');
  }
  detail(id: string) {
    return this.api.get<UserDetail>('/users/' + id);
  }
  mfa(id: string) {
    return this.api.get<MfaStatus>('/auth/mfa/users/' + id);
  }
}
