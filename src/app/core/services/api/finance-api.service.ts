import { inject, Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { components } from './generated/schema';
export type Invoice = components['schemas']['InvoiceResponse'];
export type Billing = components['schemas']['BillingResponse'];
export type Payment = components['schemas']['PaymentResponse'];
export type Receipt = components['schemas']['ReceiptResponse'];
export type Adjustment = components['schemas']['AdjustmentResponse'];
export type FinanceKind = 'invoices' | 'billings' | 'payments' | 'receipts';
@Injectable({ providedIn: 'root' })
export class FinanceApi {
 private api = inject(ApiClient);
 invoices() { return this.api.get<Invoice[]>('/finance/invoices'); }
 billings() { return this.api.get<Billing[]>('/finance/billings'); }
 invoice(id: string) { return this.api.get<Invoice>('/finance/invoices/' + id); }
 billing(id: string) { return this.api.get<Billing>('/finance/billings/' + id); }
 payment(id: string) { return this.api.get<Payment>('/finance/payments/' + id); }
 receipt(id: string) { return this.api.get<Receipt>('/finance/receipts/' + id); }
 adjustments(invoiceId: string) { return this.api.get<Adjustment[]>('/finance/invoices/' + invoiceId + '/adjustments'); }
}
