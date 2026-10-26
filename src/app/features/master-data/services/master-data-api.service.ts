import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
export type MasterRow=components['schemas']['MasterDataRow'];
export type MasterOptions=components['schemas']['MasterDataOptions'];
export type MasterPage=components['schemas']['MasterDataPage'];
export type MasterMutation=components['schemas']['MasterDataMutation'];
export type MaterialPrice=components['schemas']['MaterialReferenceHistory'];
@Injectable({providedIn:'root'})
export class MasterDataApi {
  private api=inject(ApiClient);
  options(){return this.api.get<MasterOptions>('/master-data/options');}
  list(kind:string,search:string,active:string,page:number){return this.api.get<MasterPage>('/master-data/'+kind,{search,active,page,pageSize:25});}
  history(id:string,page=1){return this.api.get<components['schemas']['MaterialReferenceHistoryPage']>('/master-data/items/'+encodeURIComponent(id)+'/prices',{page,pageSize:25});}
}
