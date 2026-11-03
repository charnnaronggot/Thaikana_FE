import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
export type ReportChoice = components['schemas']['ReportChoice'];
export type ReportPage = components['schemas']['ReportingPage'];
export type ReportRow = components['schemas']['ReportRow'];
export type ReportColumn = components['schemas']['ReportColumn'];
export interface ReportFilters { search: string; status: string; from: string; to: string; page: number; pageSize: number; }
@Injectable({providedIn:'root'})
export class ReportsApi {
  private api=inject(ApiClient);
  options(){return this.api.get<components['schemas']['ReportingOptions']>('/reporting/options');}
  page(kind:string,filters:ReportFilters){return this.api.get<ReportPage>('/reporting/'+encodeURIComponent(kind),{...filters});}
  async download(kind:string,filters:ReportFilters){
    const query=new URLSearchParams();for(const[key,value]of Object.entries(filters))if(value!=='')query.set(key,String(value));
    try{return await this.api.blob('/reporting/'+encodeURIComponent(kind)+'/export.csv?'+query);}
    catch(error){
      if(error instanceof HttpErrorResponse&&error.error instanceof Blob){let body;try{body=JSON.parse(await error.error.text());}catch{throw error;}throw new HttpErrorResponse({error:body,status:error.status,statusText:error.statusText,url:error.url??undefined});}
      throw error;
    }
  }
}
