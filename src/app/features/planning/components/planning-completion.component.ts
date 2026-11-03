import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { NativeApi } from '../../modules/native-api.service';

type Preview = components['schemas']['WorkOrderCompletionPreview'];
@Component({
 selector:'app-planning-completion',imports:[CommonModule,FormsModule,Drawer,StateMessage],providers:[MutationSession],
 templateUrl:'./planning-completion.component.html',styleUrl:'./planning-completion.component.scss',
})
export class PlanningCompletionTools {
 workOrderId=input.required<string>();changed=output<void>();
 readonly command=inject(MutationSession);private api=inject(NativeApi);
 preview=signal<Preview|null>(null);busy=signal(false);error=signal('');notice=signal('');open=signal(false);discard=signal(false);fieldError=signal('');
 quantity=1;reason='';private baseline='';private generation=0;
 readonly quantityLabel='จำนวนที่ยกเลิก';readonly reasonLabel='เหตุผลที่ยกเลิก';
 readonly blockers:Record<string,string>={work_order_closed:'ปิดใบสั่งผลิตแล้ว',active_run:'ต้องจบรอบที่กำลังทำหรือพักอยู่ก่อน',legacy_execution_review_required:'ต้องตรวจประวัติงานเดิมที่ซ้อนกันก่อน',inspection_pending:'QC กำลังตรวจ ต้องสรุปผลก่อน',unresolved_rework:'ต้องจัดการงานแก้ไขหรือยอด Hold ก่อน',no_cancelable_remainder:'ไม่มีจำนวนคงเหลือที่ยกเลิกได้'};
 constructor(){effect(()=>{this.workOrderId();void this.load();});}
 num(value:number|string|null|undefined){return Number(value??0);}
 canLeave(){return !this.open()&&!this.command.busy()&&!this.command.uncertain();}
 private snapshot(){return JSON.stringify([this.quantity,this.reason]);}
 async load(){const id=this.workOrderId(),generation=++this.generation;this.busy.set(true);this.error.set('');try{const preview=await this.api.get<Preview>('/planning/work-orders/'+id+'/completion');if(generation===this.generation)this.preview.set(preview);}catch(e){if(generation===this.generation)this.error.set(problemMessage(e));}finally{if(generation===this.generation)this.busy.set(false);}}
 begin(){const preview=this.preview();if(!preview?.canCancel||this.busy()||!this.canLeave())return;this.command.clear();this.quantity=this.num(preview.cancelable);this.reason='';this.fieldError.set('');this.notice.set('');this.baseline=this.snapshot();this.open.set(true);}
 close(){if(this.command.busy()||this.command.uncertain())return;if(this.snapshot()!==this.baseline)this.discard.set(true);else this.abandon();}
 abandon(){this.open.set(false);this.discard.set(false);this.command.clear();}
 returns(){return this.preview()?.materials.filter(x=>this.num(x.returnRequired)>0)??[];}
 async save(){const preview=this.preview();if(!preview||this.busy()||this.command.busy()||this.command.uncertain())return;this.fieldError.set('');if(!preview.canCancel){this.fieldError.set('งานเปลี่ยนสถานะแล้ว ให้ตรวจเงื่อนไขก่อนยกเลิกยอดค้าง');return;}if(!Number.isFinite(this.quantity)||this.quantity<=0||this.quantity>this.num(preview.cancelable)||!this.reason.trim()){this.fieldError.set('ระบุจำนวนที่มากกว่าศูนย์ ไม่เกินยอดที่ยกเลิกได้ พร้อมเหตุผล');return;}
  const body={expectedVersion:preview.version,quantity:this.quantity,reason:this.reason.trim()} satisfies components['schemas']['CancelWorkOrderRemainder'];
  await this.command.run<Preview>('/planning/work-orders/'+preview.id+'/cancel-remainder',body,async result=>{this.preview.set(result);this.open.set(false);this.notice.set('บันทึกยกเลิกยอดค้างแล้ว · เป้าหมายผลิต '+result.target+' '+result.unit);this.changed.emit();});
 }
 async reloadConflict(){if(this.command.uncertain()||this.command.busy()||this.busy())return;this.command.clear();await this.load();this.fieldError.set('โหลดข้อมูลล่าสุดแล้ว · จำนวนและเหตุผลเดิมยังอยู่ กรุณาตรวจอีกครั้ง');}
}
