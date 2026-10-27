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
  const mediaMessages:Record<string,string>={invalid_image:'รูปไม่ครบหรือเปิดอ่านไม่ได้ กรุณาเลือกไฟล์ PNG/JPEG/WebP ต้นฉบับอีกครั้ง',image_dimensions_exceeded:'รูปต้องไม่เกิน 24 ล้านพิกเซล และด้านละ 12,000 พิกเซล กรุณาย่อสำเนาก่อนอัปโหลด',animated_image_not_supported:'กรุณาใช้ภาพนิ่ง PNG/JPEG/WebP แทนภาพเคลื่อนไหว',image_processing_busy:'ระบบกำลังประมวลผลรูป กรุณารอสักครู่แล้วลองคำขอเดิม',preview_generation_failed:'สร้างภาพตัวอย่างไม่ได้ กรุณาลองไฟล์รูปอื่น',file_integrity_failed:'ไฟล์ไม่ตรงกับข้อมูลที่เก็บไว้ กรุณาให้ผู้ดูแลตรวจสำเนาสำรอง',file_missing:'ไม่พบไฟล์ต้นฉบับ กรุณาให้ผู้ดูแลตรวจที่เก็บไฟล์หรือสำเนาสำรอง',material_cost_required:'กรอกต้นทุนวัสดุที่ทราบราคา หากไม่มีค่าใช้จ่ายให้ยืนยันพร้อมแหล่งอ้างอิง',work_order_template_required:'ยังไม่มีแบบเอกสารใบงาน กรุณาให้ผู้ดูแลตั้งค่า Template ก่อน',released_work_order_required:'Planner ต้องทบทวนและ Release ใบงานก่อนออกเอกสาร',document_superseded:'เอกสารต้นทางเปลี่ยนหรือถูกยกเลิก กรุณาเปิดข้อมูลล่าสุด',login_challenge_capacity:'มีคำขอเข้าสู่ระบบจำนวนมาก กรุณารอสักครู่แล้วลองใหม่'};
  if(p?.code&&mediaMessages[p.code])return mediaMessages[p.code];
  const reportMessages:Record<string,string>={report_scope_changed:'สิทธิ์หรือ Session เปลี่ยนแล้ว กรุณาโหลดรายงานล่าสุดก่อนดาวน์โหลด',report_too_large:'รายงานมีมากกว่า 10,000 รายการ กรุณาลดช่วงวันที่หรือระบุคำค้นก่อนดาวน์โหลด',report_date_not_supported:'รายงานนี้แสดงยอดคงคลังปัจจุบัน กรุณาล้างช่วงวันที่',invalid_date_range:'วันเริ่มต้องไม่อยู่หลังวันสิ้นสุด'};
  if(p?.code&&reportMessages[p.code])return reportMessages[p.code];
  const qualityMessages:Record<string,string>={
    material_or_process_not_ready:'ยังเริ่มไม่ได้ กรุณาให้ Planner ตรวจขั้นผลิต และให้คลังเบิกวัสดุหรือรับชิ้นงานแก้ไขให้ครบก่อน',
    inactive_station:'สถานีนี้ปิดใช้งานอยู่ กรุณาให้ผู้ดูแลตรวจสอบก่อนเริ่มงาน',
    inspection_exceeds_input:'จำนวนเกินยอดที่ยังตรวจได้ กรุณาโหลดคิวล่าสุด · งานที่ย้อนผลให้เริ่มตรวจใหม่จากใบเดิม',
    qc_fg_receipt_outstanding:'ยังมี FG รับเข้าคลังอยู่ ให้คลังปลดการจอง/หยิบและย้อนรับสินค้าก่อนย้อนผลตรวจ',
    qc_rework_referenced:'มีงานแก้ไขอ้างผลตรวจนี้ ให้ Planner ตรวจสอบงานปลายทางก่อน ผลเดิมยังต้องเก็บไว้',
    qc_work_order_cancelled:'WO ต้นทางถูกยกเลิกแล้ว กรุณาตรวจสอบกับ Planner',
    qc_lifecycle_state:'สถานะผลตรวจเปลี่ยนแล้ว กรุณาปิดหน้าต่างและตรวจผลล่าสุด',
    qc_correction_exists:'มีใบตรวจแก้ไขต่อจากใบนี้แล้ว กรุณาเปิดใบตรวจล่าสุด',
    qc_correction_source:'เริ่มตรวจแก้ไขจากใบที่ย้อนผล โดยใช้ขั้นผลิตและจำนวนเดิม',
    qc_lifecycle_paused:'ระบบระงับการเปลี่ยนผลตรวจชั่วคราว กรุณาติดต่อผู้ดูแล',
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
