import {CommonModule} from '@angular/common';
import {Component,inject,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {ApiClient,problemMessage} from '../../../core/services/api/api-client.service';
import {StateMessage} from '../../../shared/components/ui';
import type{components} from '../../../core/services/api/generated/native-schema';
type Overview=components['schemas']['OperationsOverview'];
type StoragePage=components['schemas']['StorageReviewPage'];
type Integrity=components['schemas']['FileIntegrityResult'];
@Component({imports:[CommonModule,FormsModule,RouterLink,StateMessage],templateUrl:'./operations-workspace.component.html',styleUrl:'./operations-workspace.component.scss'})
export class OperationsWorkspace {
  private api=inject(ApiClient);data=signal<Overview|null>(null);storage=signal<StoragePage|null>(null);
  loading=signal(false);storageLoading=signal(false);inspecting=signal('');error=signal('');storageError=signal('');fileError=signal('');
  results=signal<Record<string,Integrity>>({});fileId='';area='uploads';private generation=0;private storageGeneration=0;private tokens:(string|null)[]=[null];storagePage=1;
  readonly num=Number;
  readonly status:Record<string,string>={not_configured:'ยังไม่เชื่อมสถานะ Backup',state_unavailable:'อ่านสถานะไม่ได้',failed:'สำรองไม่สำเร็จ',worker_stale:'ไม่ได้รับสถานะ Worker ล่าสุด',backup_overdue:'เกินช่วงสำรองที่กำหนด',alerts_pending:'มีแจ้งเตือนค้าง',recorded:'มีบันทึกสำรองล่าสุด',PENDING:'รอสร้าง',PROCESSING:'กำลังสร้าง',FAILED:'สร้างไม่สำเร็จ',COMPLETED:'มีทะเบียนไฟล์',UNREFERENCED_REVIEW:'ไม่มีทะเบียน · รอตรวจ',RECENT_UNREFERENCED:'ไฟล์ใหม่ที่ยังไม่พบทะเบียน',verified:'ขนาดและ Hash ตรง',verified_incomplete:'ไฟล์ตรง · การอัปโหลดยังไม่จบ',file_missing:'ไม่พบไฟล์ใน Storage',file_integrity_failed:'ไฟล์ไม่ตรงกับ Hash / ขนาด'};
  ngOnInit(){void this.load();}
  ngOnDestroy(){this.generation++;this.storageGeneration++;}
  canLeave(){return true;}
  async load(){const generation=++this.generation;this.loading.set(true);this.error.set('');try{const data=await this.api.get<Overview>('/operations/overview');if(generation===this.generation)this.data.set(data);}catch(e){if(generation===this.generation)this.error.set(problemMessage(e));}finally{if(generation===this.generation)this.loading.set(false);}}
  async inventory(reset=false){if(reset){this.storagePage=1;this.tokens=[null];}const generation=++this.storageGeneration;this.storageLoading.set(true);this.storageError.set('');try{const result=await this.api.get<StoragePage>('/operations/storage',{area:this.area,token:this.tokens[this.storagePage-1]??undefined});if(generation===this.storageGeneration){this.storage.set(result);if(result.nextToken)this.tokens[this.storagePage]=result.nextToken;else this.tokens=this.tokens.slice(0,this.storagePage);}}catch(e){if(generation===this.storageGeneration)this.storageError.set(problemMessage(e));}finally{if(generation===this.storageGeneration)this.storageLoading.set(false);}}
  page(delta:number){this.storagePage+=delta;void this.inventory();}
  async inspect(id=this.fileId){if(this.inspecting())return;this.fileError.set('');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim())){this.fileError.set('ระบุรหัสไฟล์ UUID ให้ครบ');return;}id=id.trim();this.inspecting.set(id);try{const result=await this.api.get<Integrity>('/operations/files/'+encodeURIComponent(id)+'/integrity');this.results.update(x=>({...x,[id]:result}));}catch(e){this.fileError.set(problemMessage(e));}finally{this.inspecting.set('');}}
  result(id:string){const value=this.results()[id];return value?this.status[value.status]??value.status:'';}
  path(route:string){return route.split('?')[0];}
  query(route:string){return Object.fromEntries(new URLSearchParams(route.split('?')[1]??''));}
}
