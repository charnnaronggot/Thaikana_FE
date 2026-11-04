import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
export type GlobalSearchResult=components['schemas']['GlobalSearchResult'];
export type SearchGroup=components['schemas']['SearchGroup'];
export type SearchHit=components['schemas']['SearchHit'];
@Injectable({providedIn:'root'})
export class SearchApi {
  private api=inject(ApiClient);
  search(q:string){return this.api.get<GlobalSearchResult>('/search',{q});}
}
