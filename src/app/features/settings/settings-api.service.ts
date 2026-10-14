import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../core/services/api/api-client.service';
import { CompanyDefaults, CompanySettings } from './settings.models';
@Injectable({providedIn:'root'})
export class SettingsApi {
  private api = inject(ApiClient);
  current() { return this.api.get<CompanySettings>('/settings'); }
  defaults() { return this.api.get<CompanyDefaults>('/settings/defaults'); }
}
