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
  const messages:Record<string,string>={stale_version:'ข้อมูลบัญชีหรือเอกสารเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก',user_conflict:'Username อีเมล หรือรหัสบัญชีนี้มีอยู่แล้ว กรุณาตรวจและแก้ไข',last_system_admin:'ต้องเหลือ Admin ที่เปิดใช้งานอย่างน้อยหนึ่งบัญชี',idempotency_mismatch:'คำสั่งเดิมมีข้อมูลต่างกัน กรุณาตรวจผลเดิมก่อนเริ่มใหม่',mfa_reset_forbidden:'ให้ Admin อีกบัญชีตรวจตัวบุคคลและรีเซ็ต MFA ให้',station_roles:'บัญชี Station ต้องใช้ Role Station และผูกกับสถานีเดียว',invalid_stations:'สถานีบางรายการถูกปิดใช้หรือไม่พบ กรุณาเลือกสถานีใหม่'};
  if(p?.code&&messages[p.code])return messages[p.code];
  const qualityMessages:Record<string,string>={
    material_or_process_not_ready:'ยังเริ่มไม่ได้ กรุณาให้ Planner ตรวจขั้นผลิต และให้คลังเบิกวัสดุหรือรับชิ้นงานแก้ไขให้ครบก่อน',
    inactive_station:'สถานีนี้ปิดใช้งานอยู่ กรุณาให้ผู้ดูแลตรวจสอบก่อนเริ่มงาน',
    inspection_exceeds_input:'จำนวนตรวจเกินยอดที่ยังตรวจได้ กรุณาโหลดคิวล่าสุด',
    inspection_frozen:'ผลตรวจนี้ยืนยันแล้ว กรุณาเปิดผลล่าสุดเพื่อดูประวัติ',
    quality_template_frozen:'แบบตรวจนี้เผยแพร่แล้ว ให้สร้าง Revision ใหม่เมื่อต้องการแก้ไข',
    qc_photo_slots_incomplete:'ยังแนบรูปที่บังคับไม่ครบ กรุณาตรวจแต่ละด้านก่อนยืนยัน',
    legacy_qc_evidence_review_required:'ให้ QC ตรวจทานหลักฐานเดิมและกำหนดด้านรูปก่อนยืนยันผล',
    qc_results_incomplete:'ยังบันทึกจุดตรวจที่บังคับไม่ครบ กรุณากลับไปตรวจ Checklist',
    content_type_mismatch:'ไฟล์ไม่ตรงกับชนิดที่ระบุ กรุณาเลือกไฟล์ภาพที่สมบูรณ์',
    invalid_inspection_result:'ระบุจุดตรวจและข้อสังเกตให้ครบก่อนบันทึก',
    inactive_quality_group:'กลุ่ม QC นี้ปิดใช้งาน กรุณาให้ผู้ดูแลตรวจสอบกลุ่มของสินค้า',
    published_quality_template_required:'กลุ่มสินค้านี้ยังไม่มีแบบตรวจที่เผยแพร่ ให้ QC ตรวจตั้งค่าก่อนเริ่ม',
  };
  if(p?.code&&qualityMessages[p.code])return qualityMessages[p.code];
  const errors=p?.errors?Object.values(p.errors).flat().join(' · '):'';
  return errors||p?.detail||p?.title||({401:'Session หมดอายุ กรุณาเข้าสู่ระบบ',403:'ไม่มีสิทธิ์ในรายการนี้',409:'ข้อมูลเปลี่ยน กรุณารีเฟรชก่อนทำรายการ',429:'ยืนยันผิดเกินกำหนด กรุณารอแล้วลองอีกครั้ง'}[error.status]??'ไม่สามารถทำรายการได้');
}
@Injectable({providedIn:'root'})
export class ApiClient {
 private http=inject(HttpClient);
 private url(path:string){return environment.apiUrl+(/^\/(quotations|quotation-revisions|sales-orders|customers|product-revisions|designs|settings|documents|files|uoms)(\/|$)/.test(path)?'/sales-ui':'')+path;}
 get<T>(path:string, query:Record<string,string|number|boolean|undefined>={}) { let params=new HttpParams();for(const [k,v] of Object.entries(query))if(v!==undefined&&v!=='')params=params.set(k,v);return firstValueFrom(this.http.get<T>(this.url(path),{params,withCredentials:true})); }
 post<T>(path:string,body:unknown={},key:string=crypto.randomUUID()) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError()); return firstValueFrom(this.http.post<T>(this.url(path),body,{withCredentials:true,headers:new HttpHeaders({'Idempotency-Key':key})})); }
 put<T>(path:string,body:unknown) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError()); return firstValueFrom(this.http.put<T>(this.url(path),body,{withCredentials:true})); }
 patch<T>(path:string,body:unknown) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError()); return firstValueFrom(this.http.patch<T>(this.url(path),body,{withCredentials:true,headers:new HttpHeaders({'Idempotency-Key':crypto.randomUUID()})})); }
 upload<T>(path:string,file:File) {if(navigator.onLine===false)return Promise.reject<T>(new OfflineTransactionError());const body=new FormData();body.append('file',file);return firstValueFrom(this.http.post<T>(this.url(path),body,{withCredentials:true}));}
 file(id:string) {return firstValueFrom(this.http.get(this.url('/files/'+id),{responseType:'blob',withCredentials:true}));}
 blob(path:string) {return firstValueFrom(this.http.get(this.url(path),{responseType:'blob',withCredentials:true}));}
 page<T>(path:string,search='',page=1,status='') {return this.get<Page<T>>(path,{search,page,pageSize:25,status});}
}
