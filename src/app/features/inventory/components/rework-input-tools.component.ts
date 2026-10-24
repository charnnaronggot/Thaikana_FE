import { CommonModule } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { components } from '../../../core/services/api/generated/native-schema';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { NativeApi } from '../../modules/native-api.service';

type Input=components['schemas']['ReworkInputSummary'];
@Component({selector:'app-rework-input-tools',imports:[CommonModule,FormsModule,Drawer,StateMessage],providers:[MutationSession],
 templateUrl:'./rework-input-tools.component.html',styleUrl:'./rework-input-tools.component.scss'})
export class ReworkInputTools {
 enabled=input(true);changed=output<void>();readonly command=inject(MutationSession);private api=inject(NativeApi);
 open=signal(false);busy=signal(false);error=signal('');notice=signal('');discard=signal(false);rows=signal<Input[]>([]);
 selectedId='';search='';mode:'transfer'|'return'='transfer';quantity=1;reason='';private baseline='';
 num(value:number|string|null|undefined){return Number(value??0);}
 canLeave(){return !this.busy()&&!this.open()&&!this.command.busy()&&!this.command.uncertain();}
 selected(){return this.rows().find(x=>x.workOrderId===this.selectedId);}
 limit(){const selected=this.selected();return this.num(this.mode==='transfer'?selected?.transferable:selected?.returnable);}
 allowed(){const row=this.selected();return !!row&&(this.mode==='transfer'?row.canTransfer:row.canReturn);}
 private snapshot(){return JSON.stringify([this.selectedId,this.mode,this.quantity,this.reason]);}
 async begin(){if(!this.enabled()||!this.canLeave()||this.busy())return;this.command.clear();this.search='';this.reason='';this.notice.set('');await this.load();if(this.error())return;this.selectedId=this.rows()[0]?.workOrderId??'';this.choose();this.baseline=this.snapshot();this.open.set(true);}
 choose(){const selected=this.selected();this.mode=selected?.returnRequired&&this.num(selected.returnRequired)>0?'return':selected?.canTransfer?'transfer':'return';this.quantity=this.limit();}
 chooseMode(){this.quantity=this.limit();}
 async load(){if(this.busy()||this.command.busy()||this.command.uncertain())return;this.busy.set(true);this.error.set('');try{this.rows.set(await this.api.get<Input[]>('/inventory/rework-inputs',{search:this.search}));}catch(e){this.error.set(problemMessage(e));}finally{this.busy.set(false);}}
 close(){if(this.command.busy()||this.command.uncertain())return;if(this.snapshot()!==this.baseline)this.discard.set(true);else this.abandon();}
 abandon(){this.open.set(false);this.discard.set(false);this.command.clear();}
 async reloadConflict(){if(this.command.busy()||this.command.uncertain())return;this.command.clear();await this.load();this.notice.set('โหลดข้อมูลล่าสุดแล้ว · จำนวนและเหตุผลเดิมยังอยู่ กรุณาตรวจอีกครั้ง');}
 async save(){
  const selected=this.selected();if(!selected||this.busy()||this.command.busy()||this.command.uncertain())return;
  this.error.set('');if(!this.allowed()||!Number.isFinite(this.quantity)||this.quantity<=0||this.quantity>this.limit()||!this.reason.trim()){this.error.set('เลือก WO ที่พร้อมรับ/คืน ระบุจำนวนไม่เกินยอดที่ทำได้ พร้อมเหตุผล');return;}
  const body={expectedVersion:selected.version,quantity:this.quantity,reason:this.reason.trim()} satisfies components['schemas']['ReworkInputCommand'];
  await this.command.run<Input>('/inventory/rework-inputs/'+selected.workOrderId+'/'+this.mode,body,result=>{this.open.set(false);this.notice.set((this.mode==='transfer'?'ยืนยันรับชิ้นงานแล้ว · ':'บันทึกคืนชิ้นงานแล้ว · ')+result.workOrderNo);this.changed.emit();});
 }
}
