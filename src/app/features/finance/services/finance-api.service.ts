import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { components } from '../../../core/services/api/generated/native-schema';
import {
  OfflineTransactionError,
  problemMessage,
} from '../../../core/services/api/api-client.service';
import { NativeApi } from '../../modules/native-api.service';

export type FinanceWorkspace = components['schemas']['FinanceWorkspace'];
export type FinanceSources = components['schemas']['FinanceSources'];
export type FinanceInvoice = components['schemas']['FinanceInvoiceDetail'];
export type FinancePayment = components['schemas']['FinancePaymentDetail'];
export type FinanceBilling = components['schemas']['FinanceBillingDetail'];
export type FinanceAdjustment = components['schemas']['FinanceAdjustmentDetail'];
export type FinanceReceipt = components['schemas']['FinanceReceiptDetail'];
export type FinanceMutation = components['schemas']['FinanceMutation'];
export type FinanceTab =
  'invoices' | 'outstanding' | 'payments' | 'billings' | 'receipts' | 'adjustments';
export type FinanceKind = Exclude<FinanceTab, 'outstanding'>;
export type FinanceOutput = components['schemas']['FinanceOutput'];
export function financeError(e: unknown) {
  const code = e instanceof HttpErrorResponse ? e.error?.code : '';
  const messages: Record<string, string> = {
    stale_version: 'ข้อมูลหรือยอดค้างเปลี่ยนแล้ว โหลดข้อมูลล่าสุดและตรวจยอดก่อนบันทึกอีกครั้ง',
    forbidden: 'ไม่มีสิทธิ์ในเอกสารหรือคำสั่งนี้ กรุณาให้ผู้รับผิดชอบตรวจสอบ',
    payment_exceeds_outstanding: 'ยอดค้างของ Invoice เปลี่ยนแล้ว กรุณาตรวจและจัดสรรยอดใหม่',
    payment_over_allocated: 'ยอดที่จัดสรรเกินเงินรับจริงหรือเงินที่ยังไม่ได้จัดสรร',
    payment_evidence_required: 'แนบหลักฐานรับเงินจริงก่อนยืนยันรับเงิน',
    payment_reference_used: 'เลขอ้างอิงนี้มีการยืนยันรับเงินแล้ว ตรวจรายการเดิมก่อนบันทึก',
    invoice_source_exhausted: 'จำนวนต้นทางถูกใช้ไปแล้ว โหลด SO หรือรอบส่งล่าสุดก่อนเลือกใหม่',
    source_quantity_exhausted: 'จำนวนที่เรียกเก็บเกินยอดต้นทางคงเหลือ',
    company_settings_required: 'ตั้งค่าชื่อบริษัท ที่อยู่ และสกุลเงินบาทให้ครบก่อนออกเอกสาร',
    invoice_already_billed: 'Invoice นี้มีใบวางบิลอยู่แล้ว เปิดใบเดิมหรือยกเลิกก่อนสร้างใหม่',
    credit_exceeds_outstanding: 'ลดหนี้เกินยอดค้าง ต้องตรวจหรือย้อนรับเงินที่เกี่ยวข้องก่อน',
    content_type_mismatch: 'ไฟล์ไม่ตรงกับชนิดที่ระบุ เลือกภาพหรือ PDF ที่เปิดได้สมบูรณ์',
    file_too_large: 'แนบได้ไม่เกิน 5 ไฟล์ รวมไม่เกิน 20 MiB',
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
export class FinanceApi {
  private native = inject(NativeApi);
  private http = inject(HttpClient);
  workspace(tab: FinanceTab = 'invoices', search = '', status = '', page = 1, pageSize = 20) {
    return this.native.get<FinanceWorkspace>('/finance/workspace', {
      tab,
      search,
      status,
      page,
      pageSize,
    });
  }
  sources(orderId = '', deliveryId = '', editingInvoiceId = '', search = '') {
    return this.native.get<FinanceSources>(
      '/finance/sources',
      Object.fromEntries(
        Object.entries({ orderId, deliveryId, editingInvoiceId, search }).filter(
          ([, v]) => v !== '',
        ),
      ),
    );
  }
  invoice(id: string) {
    return this.native.get<FinanceInvoice>('/finance/invoices/' + id);
  }
  payment(id: string) {
    return this.native.get<FinancePayment>('/finance/payments/' + id);
  }
  billing(id: string) {
    return this.native.get<FinanceBilling>('/finance/billings/' + id);
  }
  adjustment(id: string) {
    return this.native.get<FinanceAdjustment>('/finance/adjustments/' + id);
  }
  receipt(id: string) {
    return this.native.get<FinanceReceipt>('/finance/receipts/' + id);
  }
  outputs(kind: string, id: string) {
    return this.native.get<FinanceOutput[]>('/finance/documents/' + kind + '/' + id);
  }
  state(kind: string, key: string) {
    return this.native.get<components['schemas']['FinanceCommandState']>(
      '/finance/commands/' + encodeURIComponent(key),
      { kind },
    );
  }
  file(id: string) {
    return this.native.file(id);
  }
  upload(path: string, body: unknown, files: readonly File[], key: string) {
    if (navigator.onLine === false) return Promise.reject(new OfflineTransactionError());
    const form = new FormData();
    form.append('data', JSON.stringify(body));
    for (const file of files) form.append('evidence', file, file.name);
    return firstValueFrom(
      this.http.post<FinanceMutation>(environment.apiUrl + path, form, {
        withCredentials: true,
        headers: new HttpHeaders({ 'Idempotency-Key': key }),
      }),
    );
  }
}
