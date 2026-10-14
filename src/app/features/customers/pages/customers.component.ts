import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { CustomerApi } from '../customer-api.service';
import { Customer, SaveCustomer } from '../models/customer.models';
@Component({imports:[FormsModule,ReactiveFormsModule,RouterLink,Drawer,StateMessage],providers:[MutationSession],templateUrl:'./customers.component.html',styleUrl:'./customers.component.scss'})
export class CustomersComponent {
 readonly auth=inject(AuthService);readonly mutation=inject(MutationSession);private customers=inject(CustomerApi);private fb=inject(FormBuilder);
 readonly loading=signal(false);readonly detailLoading=signal(false);readonly error=signal('');readonly detailError=signal('');readonly notice=signal('');
 readonly rows=signal<Customer[]>([]);readonly selected=signal<Customer|null>(null);readonly open=signal(false);readonly editing=signal(false);readonly total=signal(0);
 readonly blocked=computed(()=>this.detailLoading()||this.mutation.busy()||this.mutation.uncertain());
 readonly filters=[{value:'all',label:'ทั้งหมด'},{value:'active',label:'ใช้งานอยู่'},{value:'inactive',label:'ปิดใช้งาน'}];
 query='';status='all';page=1;private generation=0;
 readonly form=this.fb.nonNullable.group({code:['',[Validators.required,Validators.maxLength(50),Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)]],name:['',[Validators.required,Validators.maxLength(200)]],taxReference:['',Validators.maxLength(20)],contactName:['',Validators.maxLength(150)],phone:['',Validators.maxLength(50)],email:['',[Validators.email,Validators.maxLength(256)]],billingAddress:['',[Validators.required,Validators.maxLength(500)]],shippingAddress:['',[Validators.required,Validators.maxLength(500)]],isActive:[true],reason:['',[Validators.required,Validators.minLength(3),Validators.maxLength(1000)]]});
 ngOnInit(){void this.load();}
 canLeave(){return !this.blocked()&&(!this.open()||!this.editing()||!this.form.dirty||confirm('มีข้อมูลลูกค้าที่ยังไม่บันทึก ต้องการออกหรือไม่?'));}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.blocked()||this.open()&&this.editing()&&this.form.dirty)event.preventDefault();}
 async load(){const generation=++this.generation;this.loading.set(true);this.error.set('');try{const page=await this.customers.list(this.query,this.page,this.status==='all'?undefined:this.status==='active');if(generation!==this.generation)return;this.rows.set(page.items);this.total.set(page.totalCount??0);}catch(e){if(generation===this.generation)this.error.set(problemMessage(e));}finally{if(generation===this.generation)this.loading.set(false);}}
 search(){this.page=1;void this.load();}next(delta:number){this.page+=delta;void this.load();}
 create(){if(this.blocked())return;this.selected.set(null);this.form.reset();this.form.controls.isActive.setValue(true);this.detailError.set('');this.editing.set(true);this.open.set(true);}
 async detail(row:Customer){if(this.blocked())return;this.open.set(true);this.editing.set(false);this.selected.set(row);await this.reloadDetail();}
 async reloadDetail(){if(this.mutation.busy()||this.mutation.uncertain())return;const id=this.selected()?.id;if(!id)return;if(this.editing()&&this.form.dirty&&!confirm('โหลดข้อมูลล่าสุดและแทนที่ข้อมูลที่กำลังแก้ไขหรือไม่?'))return;this.detailLoading.set(true);this.detailError.set('');try{this.selected.set(await this.customers.detail(id));if(this.editing())this.edit();}catch(e){this.detailError.set(problemMessage(e));}finally{this.detailLoading.set(false);}}
 edit(){const c=this.selected();if(!c)return;this.form.reset({code:c.code,name:c.name,taxReference:c.taxReference??'',contactName:c.contactName??'',phone:c.phone??'',email:c.email??'',billingAddress:this.address(c,'Billing'),shippingAddress:this.address(c,'Shipping'),isActive:c.isActive??true,reason:''});this.editing.set(true);}
 address(c:Customer,type:string){return c.addresses.find(a=>a.addressType===type)?.addressText??'';}
 close(){if(!this.canLeave())return;this.open.set(false);this.selected.set(null);this.editing.set(false);}
 async save(){if(this.blocked())return;this.form.markAllAsTouched();if(this.form.invalid)return;const v=this.form.getRawValue(),optional=(s:string)=>s.trim()||null;const body:SaveCustomer={...v,code:v.code.trim(),name:v.name.trim(),billingAddress:v.billingAddress.trim(),shippingAddress:v.shippingAddress.trim(),taxReference:optional(v.taxReference),contactName:optional(v.contactName),phone:optional(v.phone),email:optional(v.email),reason:v.reason.trim(),expectedVersion:this.selected()?.version??null};
   this.detailError.set('');await this.mutation.run<Customer>('/customers'+(this.selected()?'/'+this.selected()!.id:''),body,async result=>{this.selected.set(result);this.form.markAsPristine();this.editing.set(false);this.notice.set('บันทึกลูกค้าแล้ว');await this.load();});
 }
}
