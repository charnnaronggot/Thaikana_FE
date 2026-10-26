import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { MasterDataApi, MasterOptions, MasterRow, MaterialPrice } from '../services/master-data-api.service';

@Component({imports:[CommonModule,FormsModule,Drawer,StateMessage],providers:[MutationSession],templateUrl:'./master-data-workspace.component.html',styleUrl:'./master-data-workspace.component.scss'})
export class MasterDataWorkspace {
  private api=inject(MasterDataApi);readonly command=inject(MutationSession);
  options=signal<MasterOptions|null>(null);rows=signal<MasterRow[]>([]);prices=signal<MaterialPrice[]>([]);
  loading=signal(false);historyLoading=signal(false);error=signal('');notice=signal('');formError=signal('');discard=signal(false);
  mode=signal<'edit'|'price'|'history'|null>(null);selected=signal<MasterRow|null>(null);
  readonly tabs=[{key:'items',label:'สินค้า / วัสดุ'},{key:'uoms',label:'หน่วย'},{key:'locations',label:'คลัง'},{key:'stations',label:'Station'}];
  kind='items';search='';active='';page=1;total=0;private generation=0;private historyGeneration=0;private baseline='';
  model=this.empty();
  historyPage=1;historyTotal=0;
  private empty(){return{code:'',name:'',active:true,baseUomId:'',itemType:'RM',batchManaged:true,decimalPlaces:0,defaultSequence:1,isFinalQc:false,criticalQty:0,reorderQty:0,unitCost:null as number|null,costSource:'',freeOfCharge:false,reason:''};}
  get blocked(){return this.command.busy()||this.command.uncertain();}
  get dirty(){return this.mode()!==null&&this.mode()!=='history'&&JSON.stringify(this.model)!==this.baseline;}
  get canEdit(){return !!this.options()?.canManage||this.kind==='items'&&!!this.options()?.canManageMaterials;}
  get title(){return this.mode()==='price'?'บันทึกราคาอ้างอิง':this.mode()==='history'?'ประวัติราคาอ้างอิง':(this.selected()?'แก้ไข':'เพิ่ม')+' '+(this.tabs.find(x=>x.key===this.kind)?.label??'ข้อมูลหลัก');}
  ngOnInit(){void this.initialize();}
  ngOnDestroy(){this.generation++;this.historyGeneration++;}
  @HostListener('window:beforeunload',['$event'])beforeUnload(event:BeforeUnloadEvent){if(!this.canLeave())event.preventDefault();}
  canLeave(){return !this.blocked&&(!this.dirty||window.confirm('ทิ้งข้อมูลที่ยังไม่บันทึก?'));}
  async initialize(){this.loading.set(true);this.error.set('');try{this.options.set(await this.api.options());await this.load();}catch(e){this.error.set(problemMessage(e));}finally{this.loading.set(false);}}
  async load(reset=false){if(reset)this.page=1;const generation=++this.generation;this.loading.set(true);this.error.set('');try{const data=await this.api.list(this.kind,this.search.trim(),this.active,this.page);if(generation===this.generation){this.rows.set(data.items);this.total=Number(data.total);}}catch(e){if(generation===this.generation){this.error.set(problemMessage(e));this.rows.set([]);}}finally{if(generation===this.generation)this.loading.set(false);}}
  choose(kind:string){if(this.mode()||this.blocked)return;this.kind=kind;this.search='';this.active='';void this.load(true);}
  unit(row:MasterRow){const unit=this.options()?.units.find(x=>x.id===row.baseUomId);return unit?[unit.code,unit.name].join(' · '):'—';}
  open(row:MasterRow|null=null){if(this.blocked)return;this.command.clear();this.formError.set('');this.selected.set(row);this.model=this.empty();if(row)this.model={...this.model,code:row.code,name:row.name,active:row.active,baseUomId:row.baseUomId??'',itemType:row.itemType??'RM',batchManaged:row.batchManaged,decimalPlaces:Number(row.decimalPlaces??0),defaultSequence:Number(row.defaultSequence??1),isFinalQc:!!row.isFinalQc,criticalQty:Number(row.criticalQty??0),reorderQty:Number(row.reorderQty??0)};else this.model.baseUomId=this.options()?.units[0]?.id??'';if(!row&&!this.options()?.canManageMaterials)this.model.itemType='FG';this.mode.set('edit');this.baseline=JSON.stringify(this.model);}
  async history(row:MasterRow,page=1){if(this.blocked)return;const generation=++this.historyGeneration;this.selected.set(row);this.prices.set([]);this.mode.set('history');this.formError.set('');this.historyLoading.set(true);try{const result=await this.api.history(row.id,page);if(generation===this.historyGeneration&&this.mode()==='history'){this.prices.set(result.items);this.historyPage=Number(result.page);this.historyTotal=Number(result.total);}}catch(e){if(generation===this.historyGeneration)this.formError.set(problemMessage(e));}finally{if(generation===this.historyGeneration)this.historyLoading.set(false);}}
  price(row:MasterRow){this.open(row);this.model.unitCost=null;this.model.costSource='';this.mode.set('price');this.baseline=JSON.stringify(this.model);}
  close(){if(this.blocked)return;if(this.dirty)this.discard.set(true);else this.finishClose();}
  finishClose(){this.historyGeneration++;this.historyLoading.set(false);this.discard.set(false);this.mode.set(null);this.selected.set(null);this.formError.set('');this.command.clear();}
  async save(){
    if(this.blocked)return;this.formError.set('');const row=this.selected(),price=this.mode()==='price',m=this.model;
    if(!m.reason.trim()){this.formError.set('ระบุเหตุผลก่อนบันทึก');return;}
    const needsCost=price||this.kind==='items'&&!row&&m.itemType==='RM';
    if(needsCost&&(m.unitCost===null||m.unitCost<0||m.unitCost===0&&!m.freeOfCharge||!m.costSource.trim())){this.formError.set('ระบุราคาต้นทุนและแหล่งอ้างอิง · ราคาศูนย์ต้องยืนยันว่าไม่มีค่าใช้จ่าย');return;}
    if(!price&&(!m.code.trim()||!m.name.trim())){this.formError.set('ระบุรหัสและชื่อ');return;}
    const path='/master-data/'+(price?'items/'+row!.id+'/prices':this.kind+(row?'/'+row.id:''));
    const body=price?{expectedVersion:row!.version,unitCost:m.unitCost,sourceReference:m.costSource.trim(),reason:m.reason.trim(),freeOfCharge:m.freeOfCharge}:{...m,baseUomId:m.baseUomId||null,expectedVersion:row?.version??null,code:m.code.trim(),name:m.name.trim()};
    await this.command.run(path,body,async()=>{this.options.set(await this.api.options());await this.load();if(this.error())throw Error(this.error());this.finishClose();this.notice.set(price?'บันทึกราคาอ้างอิงแล้ว · สต็อกและแบบเดิมคงเดิม':'บันทึกข้อมูลหลักแล้ว');});
  }
  retry(){return this.command.retry();}
  async reloadConflict(){const id=this.selected()?.id;await this.load();if(this.error())return;const row=this.rows().find(x=>x.id===id);if(row){const mode=this.mode();this.open(row);if(mode==='price')this.price(row);}else this.formError.set('ไม่พบรายการในหน้านี้ ให้ปิดฟอร์มและค้นหาใหม่');}
  movePage(delta:number){this.page+=delta;void this.load();}
}
