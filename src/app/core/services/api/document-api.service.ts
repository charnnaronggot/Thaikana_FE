import { inject, Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { components } from './generated/schema';
export type DocumentType = 'quotation' | 'invoice' | 'billing' | 'receipt' | 'credit-note' | 'debit-note';
type OutputSchema = components['schemas']['DocumentExportResponse'];
export type DocumentOutput = { [K in keyof Required<OutputSchema>]: NonNullable<OutputSchema[K]> } & {status?:string;lastError?:string|null};
@Injectable({ providedIn: 'root' })
export class DocumentApi {
 private api = inject(ApiClient);
 path(type: DocumentType, sourceId: string) { return '/documents/' + type + '/' + encodeURIComponent(sourceId) + '/export'; }
 get(id: string) { return this.api.get<DocumentOutput>('/documents/' + encodeURIComponent(id)); }
 retry(id: string) { return this.api.post<DocumentOutput>('/documents/' + encodeURIComponent(id) + '/retry'); }
 file(id: string) { return this.api.file(id); }
}
