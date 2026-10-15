import { Component, computed, inject, input, output } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { DocumentApi, DocumentOutput, DocumentType } from '../../core/services/api/document-api.service';
import { MutationSession } from '../utils/mutation-session';
@Component({
 selector: 'app-document-export', providers: [MutationSession], host: {'[attr.data-document-type]':'type()'},
 template: `@if(allowed()){
  @if(sourceStatus()==='Voided'){<span class="notice error" role="status">ใบเสร็จถูกยกเลิกแล้ว</span>}
  @else{<button type="button" [disabled]="command.busy()||unreleased()" (click)="download()">{{command.busy()?'กำลังสร้าง PDF…':label()}}</button>}
  @if(command.error()){<div class="notice error" role="alert">{{command.error()}} @if(command.uncertain()){<button type="button" [disabled]="command.busy()" (click)="command.retry()">ลองอีกครั้ง</button>}</div>}
 }`,
 styles: `:host{display:inline-block;max-width:100%}.notice{margin-top:8px;white-space:normal}`
})
export class DocumentExport {
 readonly type = input.required<DocumentType>();
 readonly sourceId = input.required<string>();
 readonly sourceStatus = input('');
 readonly label = input('ดาวน์โหลด PDF');
 readonly exported = output<DocumentOutput>();
 readonly command = inject(MutationSession);
 private documents = inject(DocumentApi);
 private auth = inject(AuthService);
 readonly allowed = computed(() => this.type()==='quotation' ? this.auth.has('document.manage') && this.auth.has('quotation.view') : false);
 readonly unreleased = computed(() => this.sourceStatus()==='Voided');
 async download() {
  if (!this.allowed() || this.unreleased() || this.command.busy()) return;
  await this.command.run<DocumentOutput>(this.documents.path(this.type(),this.sourceId()),{},async output => {
   // Re-read status before downloading a replayed immutable output (e.g. receipt reversal).
   let current = await this.documents.get(output.id);
   if(current.status==='FAILED') current=await this.documents.retry(output.id);
   for(let attempt=0;!current.fileId&&attempt<30;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    current=await this.documents.get(output.id);
    if(current.status==='FAILED') throw new Error(current.lastError??'PDF generation failed');
   }
   if(!current.fileId) throw new Error('PDF ยังไม่พร้อม กรุณาลองตรวจผลอีกครั้ง');
   if (current.sourceStatus==='Voided') throw new Error('ใบเสร็จถูกยกเลิกแล้ว ไม่สามารถดาวน์โหลดเป็นใบเสร็จที่ใช้งานได้');
   const blob = await this.documents.file(current.fileId);
   if (blob.type!=='application/pdf') throw new Error('ไฟล์เอกสารไม่ใช่ PDF');
   const url = URL.createObjectURL(blob), anchor = document.createElement('a');
   anchor.href=url; anchor.download=current.number.replace(/[\\/:*?"<>|]/g,'_')+'.pdf';
   anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); this.exported.emit(current);
  });
 }
}
