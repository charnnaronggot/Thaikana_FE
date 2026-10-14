import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiClient, problemMessage } from '../../core/services/api/api-client.service';
import { StateMessage } from '../../shared/components/ui';
import { FilePreview } from '../../shared/components/file-preview.component';
import { MutationSession } from '../../shared/utils/mutation-session';
import { SettingsApi } from './settings-api.service';
import { CompanySettings, SaveCompanySettings } from './settings.models';
@Component({imports:[ReactiveFormsModule,DatePipe,StateMessage,FilePreview],providers:[MutationSession],templateUrl:'./settings.component.html',styleUrl:'./settings.component.scss'})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  private api = inject(ApiClient); private settingsApi = inject(SettingsApi); private fb = inject(FormBuilder);
  readonly mutation = inject(MutationSession);
  readonly loading = signal(false); readonly uploading = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly settings = signal<CompanySettings|null>(null); readonly preview = signal(false); readonly logoId = signal<string|null>(null);
  readonly disabled = computed(()=>this.loading() || this.uploading() || this.mutation.busy() || this.mutation.uncertain());
  readonly form = this.fb.group({
    legalName:['',[Validators.required,Validators.maxLength(200)]], address:['',[Validators.required,Validators.maxLength(1000)]],
    taxId:['',[Validators.maxLength(20)]], vatRate:[null as number|null,[Validators.required,Validators.min(0),Validators.max(100)]],
    currency:['',[Validators.required,Validators.pattern(/^[A-Za-z]{3}$/)]], paymentTerms:['',[Validators.required,Validators.maxLength(2000)]],
    bankName:['',Validators.maxLength(150)], bankAccountName:['',Validators.maxLength(200)], bankAccountNumber:['',Validators.maxLength(50)],
    reason:['',[Validators.required,Validators.minLength(3),Validators.maxLength(1000)]]
  });
  ngOnInit(){void this.load();}
  canLeave(){return !this.mutation.busy() && !this.mutation.uncertain() && !this.uploading() && (!this.form.dirty || confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?'));}
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.form.dirty || this.disabled())event.preventDefault();}
  async load(){if(this.mutation.busy()||this.mutation.uncertain())return;this.loading.set(true);this.error.set('');try{this.apply(await this.settingsApi.current());}catch(e){this.error.set(problemMessage(e));}finally{this.loading.set(false);}}
  private apply(value:CompanySettings){this.settings.set(value);const current=value.current;this.logoId.set(current?.logoFileId??null);this.form.reset({legalName:current?.legalName??'',address:current?.address??'',taxId:current?.taxId??'',vatRate:current?.vatRate??null,currency:current?.currency??'',paymentTerms:current?.paymentTerms??'',bankName:current?.bankName??'',bankAccountName:current?.bankAccountName??'',bankAccountNumber:current?.bankAccountNumber??'',reason:''});}
  async upload(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file||this.disabled())return;if(!['image/png','image/jpeg'].includes(file.type)){this.error.set('โลโก้ต้องเป็น PNG หรือ JPEG');return;}this.uploading.set(true);this.error.set('');try{const uploaded=await this.api.upload<{id:string}>('/files',file);this.logoId.set(uploaded.id);this.form.markAsDirty();}catch(e){this.error.set(problemMessage(e));}finally{this.uploading.set(false);}}
  removeLogo(){this.logoId.set(null);this.form.markAsDirty();}
  async save(){if(this.disabled()||!this.settings())return;this.form.markAllAsTouched();if(this.form.invalid)return;const v=this.form.getRawValue();if(v.vatRate===null||Math.round(v.vatRate*100)/100!==v.vatRate){this.error.set('VAT ต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง');return;}
    const optional=(value:string|null)=>value?.trim()||null;
    const body:SaveCompanySettings={expectedVersion:this.settings()!.version,legalName:v.legalName!.trim(),address:v.address!.trim(),taxId:optional(v.taxId),logoFileId:this.logoId(),vatRate:v.vatRate,currency:v.currency!.trim().toUpperCase(),paymentTerms:v.paymentTerms!.trim(),bankName:optional(v.bankName),bankAccountName:optional(v.bankAccountName),bankAccountNumber:optional(v.bankAccountNumber),reason:v.reason!.trim()};
    this.error.set('');await this.mutation.run<CompanySettings>('/settings',body,result=>{this.apply(result);this.notice.set('บันทึกการตั้งค่ารุ่น '+result.current?.revision+' แล้ว');});
  }
}
