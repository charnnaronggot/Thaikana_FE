import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiProblem, Page } from '../../models/api.models';
export class OfflineTransactionError extends Error { constructor(){super('ไม่มีการเชื่อมต่อ กรุณาออนไลน์ก่อนทำรายการ');} }
export function problemMessage(error:unknown):string {
  if (!(error instanceof HttpErrorResponse)) return error instanceof Error ? error.message : 'ไม่สามารถทำรายการได้';
  const p=error.error as ApiProblem;
  if(error.status===0) return 'เชื่อมต่อระบบไม่ได้ กรุณาตรวจเครือข่ายแล้วลองอีกครั้ง';
  const errors=p?.errors?Object.values(p.errors).flat().join(' · '):'';
  return errors||p?.detail||p?.title||({401:'Session หมดอายุ กรุณาเข้าสู่ระบบ',403:'ไม่มีสิทธิ์ในรายการนี้',409:'ข้อมูลเปลี่ยน กรุณารีเฟรชก่อนทำรายการ',429:'ยืนยันผิดเกินกำหนด กรุณารอแล้วลองอีกครั้ง'}[error.status]??'ไม่สามารถทำรายการได้');
}
@Injectable({providedIn:'root'})
export class ApiClient {
 private http=inject(HttpClient);
 get<T>(path:string, query:Record<string,string|number|boolean|undefined>={}) { let params=new HttpParams();for(const [k,v] of Object.entries(query))if(v!==undefined&&v!=='')params=params.set(k,v);return firstValueFrom(this.http.get<T>(environment.apiUrl+path,{params,withCredentials:true})); }
 post<T>(path:string,body:unknown={},key:string=crypto.randomUUID()) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError()); return firstValueFrom(this.http.post<T>(environment.apiUrl+path,body,{withCredentials:true,headers:new HttpHeaders({'Idempotency-Key':key})})); }
 put<T>(path:string,body:unknown) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError()); return firstValueFrom(this.http.put<T>(environment.apiUrl+path,body,{withCredentials:true})); }
 patch<T>(path:string,body:unknown) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError()); return firstValueFrom(this.http.patch<T>(environment.apiUrl+path,body,{withCredentials:true})); }
 upload<T>(path:string,file:File) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError());const body=new FormData();body.append('file',file);return firstValueFrom(this.http.post<T>(environment.apiUrl+path,body,{withCredentials:true}));}
 file(id:string) {return firstValueFrom(this.http.get(environment.apiUrl+'/files/'+id,{responseType:'blob',withCredentials:true}));}
 blob(path:string) {return firstValueFrom(this.http.get(environment.apiUrl+path,{responseType:'blob',withCredentials:true}));}
 page<T>(path:string,search='',page=1,status='') {return this.get<Page<T>>(path,{search,page,pageSize:25,status});}
}
