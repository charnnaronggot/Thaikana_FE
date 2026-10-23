import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { components } from '../../../core/services/api/generated/native-schema';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { NativeApi } from '../../modules/native-api.service';

type SourceWorkspace=components['schemas']['ReworkSourceWorkspace'];
type Created=components['schemas']['ReworkWorkOrderCreated'];
@Component({
 imports:[CommonModule,FormsModule,RouterLink,Drawer,StateMessage],providers:[MutationSession],
 templateUrl:'./planning-rework.component.html',styleUrl:'./planning-rework.component.scss',
})
export class PlanningReworkPage {
 private api=inject(NativeApi);private route=inject(ActivatedRoute);private router=inject(Router);
 readonly command=inject(MutationSession);readonly id=this.route.snapshot.paramMap.get('id')!;
 workspace=signal<SourceWorkspace|null>(null);busy=signal(false);error=signal('');created=signal<Created|null>(null);
 discard=signal(false);fields=signal<Record<string,string>>({});notice=signal('');
 sourceKey='';targetId='';quantity=1;start='';due='';priority=0;reason='';useMaterials=false;
 materials:{id:string;quantity:number}[]=[];private baseline='';private pendingLeave:((ok:boolean)=>void)|null=null;
 readonly blockerLabels:Record<string,string>={source_not_active:'ใบต้นทางต้องยังเปิดผลิตอยู่',process_review_required:'ต้องทบทวนขั้นผลิตของใบต้นทางก่อน',wip_cost_review_required:'ต้องตรวจต้นทุนชิ้นงานต้นทางก่อน',no_rework_entitlement:'ยังไม่มีจำนวน QC ส่งแก้ / Hold หรือปัญหาที่มีชิ้นงาน Reject เหลือ'};
 ngOnInit(){void this.load(false);}
 num(value:number|string|null|undefined){return Number(value??0);}
 private snapshot(){return JSON.stringify([this.sourceKey,this.targetId,this.quantity,this.start,this.due,this.priority,this.reason,this.useMaterials,this.materials]);}
 private dirty(){return !!this.workspace()&&!this.created()&&this.snapshot()!==this.baseline;}
 canLeave():boolean|Promise<boolean>{
  if(this.command.busy()||this.command.uncertain())return false;
  if(!this.dirty())return true;
  if(this.pendingLeave)return false;
  this.discard.set(true);return new Promise(resolve=>this.pendingLeave=resolve);
 }
 confirmLeave(ok:boolean){this.discard.set(false);const resolve=this.pendingLeave;this.pendingLeave=null;resolve?.(ok);}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.dirty()||this.command.busy()||this.command.uncertain())event.preventDefault();}
 async back(){await this.router.navigate(['/planning'],{queryParams:{wo:this.id}});}
 source(){return this.workspace()?.sources.find(x=>x.sourceType+':'+x.id===this.sourceKey);}
 targets(){const current=this.source(),steps=this.workspace()?.steps??[],sourceStep=steps.find(x=>x.id===current?.operationId);return steps.filter(x=>!x.isFinalQc&&(!sourceStep||this.num(x.operationNo)<=this.num(sourceStep.operationNo)));}
 selectSource(){const source=this.source();this.quantity=this.num(source?.available)||1;this.targetId=this.targets()[0]?.id??'';}
 material(id:string){return this.workspace()?.materials.find(x=>x.id===id);}
 addMaterial(){this.materials.push({id:this.workspace()?.materials.find(x=>x.hasCost&&!this.materials.some(m=>m.id===x.id))?.id??'',quantity:1});}
 costTotal(){if(!this.useMaterials||!this.materials.length)return null;let sum=0;for(const row of this.materials){const price=this.material(row.id)?.unitCost;if(price===null||price===undefined)return null;sum+=this.num(price)*this.num(row.quantity);}return sum;}
 async load(preserve=true){
  if(this.busy()||this.command.busy()||this.command.uncertain())return;
  this.busy.set(true);this.error.set('');
  try{
   const current=await this.api.get<SourceWorkspace>('/planning/work-orders/'+this.id+'/rework-sources');this.workspace.set(current);
   if(!preserve){const today=new Date().toLocaleDateString('en-CA');this.start=today;this.due=current.dueDate;this.priority=this.num(current.priority);const source=current.sources.find(x=>this.num(x.available)>0);this.sourceKey=source?source.sourceType+':'+source.id:'';this.selectSource();this.baseline=this.snapshot();}
  }catch(e){this.error.set(problemMessage(e));}finally{this.busy.set(false);}
 }
 async reloadConflict(){if(this.command.busy()||this.command.uncertain())return;this.command.clear();await this.load();this.notice.set('โหลดข้อมูลล่าสุดแล้ว · ข้อมูลที่กรอกยังอยู่ กรุณาตรวจจำนวนและต้นทางอีกครั้ง');}
 async save(){
  const w=this.workspace(),source=this.source();if(!w||this.busy()||this.command.busy()||this.command.uncertain()||this.created())return;
  const errors:Record<string,string>={};
  if(!w.canCreate||!source||this.num(source.available)<=0)errors['source']='เลือกต้นทางที่ยังมีจำนวนสำหรับแก้ไข';
  if(!Number.isFinite(this.quantity)||this.quantity<=0||this.quantity>this.num(source?.available))errors['quantity']='จำนวนต้องมากกว่าศูนย์และไม่เกินจำนวนต้นทางที่เหลือ';
  if(!this.targets().some(x=>x.id===this.targetId))errors['target']='เลือกขั้นผลิตจากใบต้นทาง';
  if(!this.start||!this.due||this.start>this.due)errors['dates']='ระบุวันเริ่มไม่เกินวันกำหนดเสร็จ';
  if(!this.reason.trim())errors['reason']='ระบุแนวทางและเหตุผลที่แก้ไข';
  if(this.useMaterials&&(!this.materials.length||new Set(this.materials.map(x=>x.id)).size!==this.materials.length||this.materials.some(x=>!this.material(x.id)?.hasCost||!Number.isFinite(x.quantity)||x.quantity<=0)))errors['materials']='เลือกรายการวัสดุเพิ่มที่มีต้นทุนยืนยัน ไม่ซ้ำ และระบุจำนวน';
  this.fields.set(errors);if(Object.keys(errors).length)return;
  const body={expectedVersion:w.version,sourceWorkOrderId:this.id,sourceType:source!.sourceType,sourceId:source!.id,targetOperationId:this.targetId,quantity:this.quantity,dueDate:this.due,plannedStart:this.start,priority:Number(this.priority),reason:this.reason.trim(),materials:this.useMaterials?this.materials.map(x=>({sourceComponentId:x.id,quantity:x.quantity})):[]} satisfies components['schemas']['CreateReworkWorkOrder'];
  await this.command.run<Created>('/planning/rework-work-orders',body,result=>{this.created.set(result);});
 }
}
