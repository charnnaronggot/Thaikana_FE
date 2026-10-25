import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  OfflineTransactionError,
  problemMessage,
} from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { NativeApi } from '../../modules/native-api.service';

export type DeliveryWorkspace = components['schemas']['DeliveryWorkspace'];
export type DeliveryDetail = components['schemas']['DeliveryWorkspaceDetail'];
export type DeliveryOptions = components['schemas']['DeliveryOptions'];
export type Package = components['schemas']['DeliveryPackageDetail'];
export type LabelOutput = components['schemas']['DeliveryDocumentOutput'];
export function deliveryError(e: unknown) {
  const code = e instanceof HttpErrorResponse ? e.error?.code : '';
  const messages: Record<string, string> = {
    forbidden: 'ไม่มีสิทธิ์ในรอบส่งหรือคำสั่งนี้ กรุณาให้ผู้ดูแลตรวจสิทธิ์และผู้รับผิดชอบ',
    session_expired: 'Session หมดอายุ เข้าระบบด้วยบัญชีเดิมเพื่อตรวจผลคำสั่งที่รออยู่',
    invalid_state: 'สถานะรอบส่งเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนทำต่อ',
    package_mismatch: 'กล่องนี้ถูกเปลี่ยนหรือยกเลิกแล้ว กรุณาโหลดรอบส่งล่าสุด',
    inactive_location: 'ตำแหน่งเก็บสินค้านี้ปิดใช้งาน ให้คลังตรวจและเลือก FG ที่พร้อมหยิบ',
    content_type_mismatch: 'เนื้อหาไฟล์ไม่ตรงกับชนิดที่ระบุ กรุณาเลือกภาพหรือ PDF ที่สมบูรณ์',
    file_too_large: 'หลักฐานต้องมีไม่เกิน 5 ไฟล์ และรวมไม่เกิน 20 MiB',
    packing_not_ready: 'หยิบให้ครบ จัดกล่อง และสแกนตรวจหยิบ/จัดกล่องก่อนส่งออก',
    barcode_mismatch: 'บาร์โค้ดไม่ตรงกับกล่องที่เลือก กรุณาสแกนฉลากกล่องนี้',
    pick_scan_required: 'สแกนตรวจหยิบก่อนยืนยันจัดกล่อง',
    pack_exceeds_pick: 'จำนวนในกล่องเกินยอดที่หยิบไว้ กรุณาตรวจจำนวนคงเหลือ',
    pick_exceeds_available: 'ยอดพร้อมหยิบเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด',
    pick_revision_mismatch: 'ล็อตหรือ Revision ไม่ตรงกับ SO หรือการจองนี้ใช้ไม่ได้แล้ว',
    delivery_exceeds_demand: 'จำนวนรอบส่งเกินยอดค้างของ SO กรุณาโหลดข้อมูลล่าสุด',
    pod_exceeds_dispatch: 'จำนวนรับมอบเกินยอดที่ยังไม่บันทึก รวมยอดที่รอยืนยัน GPS แล้ว',
    package_exists: 'ยกเลิกกล่องที่ใช้รายการนี้ก่อนยกเลิกการหยิบ',
    invalid_driver: 'เลือกบัญชีผู้ส่งที่เปิดใช้งานและมีสิทธิ์รับมอบ',
    delivery_failure_reason_required: 'ระบุเหตุผลที่ส่งไม่สำเร็จ',
    dispatch_reversal_required: 'ยังมีสต็อกส่งออกที่ไม่ได้ย้อนรายการ ต้องให้คลังตรวจสอบก่อนยกเลิก',
    invalid_quantity_precision: 'จำนวนไม่ตรงกับหน่วยสินค้า กรุณาตรวจทศนิยม',
    stale_version: 'ข้อมูลรอบส่งเปลี่ยนแล้ว โหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง',
    label_superseded: 'กล่องหรือรอบส่งถูกยกเลิกแล้ว ฉลากเดิมใช้จัดส่งไม่ได้',
    label_template_required: 'ยังไม่มีแม่แบบฉลากที่เปิดใช้ กรุณาให้ผู้ดูแลตรวจแม่แบบเอกสาร',
  };
  return messages[code] ?? problemMessage(e);
}
export function normalizeEvidence(file: File) {
  let mime = file.type;
  if (
    !mime ||
    ['application/octet-stream', 'application/x-pdf', 'application/acrobat'].includes(mime)
  )
    mime = /\.pdf$/i.test(file.name)
      ? 'application/pdf'
      : /\.png$/i.test(file.name)
        ? 'image/png'
        : /\.jpe?g$/i.test(file.name)
          ? 'image/jpeg'
          : /\.webp$/i.test(file.name)
            ? 'image/webp'
            : mime;
  return mime === file.type
    ? file
    : new File([file], file.name, { type: mime, lastModified: file.lastModified });
}
@Injectable({ providedIn: 'root' })
export class DeliveryApi {
  private native = inject(NativeApi);
  private http = inject(HttpClient);
  workspace(search = '', status = '', page = 1) {
    return this.native.get<DeliveryWorkspace>('/delivery/workspace', {
      search,
      status,
      page,
      pageSize: 20,
    });
  }
  options(search = '') {
    return this.native.get<DeliveryOptions>('/delivery/options', { search });
  }
  detail(id: string) {
    return this.native.get<DeliveryDetail>('/delivery/' + id);
  }
  state(kind: string, key: string) {
    return this.native.get<components['schemas']['DeliveryCommandState']>(
      '/delivery/commands/' + encodeURIComponent(key),
      { kind },
    );
  }
  file(id: string) {
    return this.native.file(id);
  }
  labels(id: string, packageId: string) {
    return this.native.get<LabelOutput[]>(`/delivery/${id}/packages/${packageId}/documents`);
  }
  upload(path: string, body: unknown, files: readonly File[], key: string) {
    if (navigator.onLine === false) return Promise.reject(new OfflineTransactionError());
    const form = new FormData();
    form.append('data', JSON.stringify(body));
    for (const file of files) form.append('evidence', file, file.name);
    return firstValueFrom(
      this.http.post<unknown>(environment.apiUrl + path, form, {
        withCredentials: true,
        headers: new HttpHeaders({ 'Idempotency-Key': key }),
      }),
    );
  }
}
