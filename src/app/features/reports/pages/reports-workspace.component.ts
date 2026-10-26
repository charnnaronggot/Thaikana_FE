import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { StateMessage } from '../../../shared/components/ui';
import { ReportChoice, ReportColumn, ReportFilters, ReportPage, ReportRow, ReportsApi } from '../services/reports-api.service';

@Component({imports:[CommonModule,FormsModule,RouterLink,StateMessage],templateUrl:'./reports-workspace.component.html',styleUrl:'./reports-workspace.component.scss'})
export class ReportsWorkspacePage {
  private api=inject(ReportsApi);
  choices=signal<ReportChoice[]>([]);result=signal<ReportPage|null>(null);
  loading=signal(false);exporting=signal(false);error=signal('');notice=signal('');
  kind='';search='';status='';from='';to='';page=1;readonly pageSize=25;
  private generation=0;private alive=true;
  private appliedFilters='';
  readonly statuses:Record<string,string>={DRAFT:'ร่าง',RELEASED:'ปล่อยแล้ว',IN_PROGRESS:'กำลังทำ',COMPLETED:'ครบแล้ว',CANCELLED:'ยกเลิก',CONFIRMED:'ยืนยันแล้ว',PARTIALLY_DELIVERED:'ส่งบางส่วน',UNRESTRICTED:'พร้อมใช้',QUALITY:'รอตรวจ',HOLD:'พักรอ',BLOCKED:'ระงับ',UNPAID:'รอชำระ',PARTIAL:'ชำระบางส่วน',PAID:'ชำระครบ',CREDITED:'ปรับยอดครบ'};
  ngOnInit(){void this.initialize();}
  ngOnDestroy(){this.alive=false;this.generation++;}
  canLeave(){return true;}
  num(value:unknown){return Number(value??0);}
  private filterKey(){return JSON.stringify([this.kind,this.search.trim(),this.status,this.from,this.to]);}
  filtersPending(){return this.appliedFilters!==this.filterKey();}
  choice(){return this.choices().find(x=>x.kind===this.kind);}
  filters():ReportFilters{return{search:this.search.trim(),status:this.status,from:this.from,to:this.to,page:this.page,pageSize:this.pageSize};}
  async initialize(){
    const generation=++this.generation;this.loading.set(true);this.error.set('');
    try{const options=await this.api.options();if(!this.alive||generation!==this.generation)return;this.choices.set(options.reports);this.kind=options.reports.some(x=>x.kind===this.kind)?this.kind:options.reports[0]?.kind??'';}
    catch(error){if(this.alive&&generation===this.generation)this.error.set(problemMessage(error));}
    finally{if(this.alive&&generation===this.generation)this.loading.set(false);}
    if(this.alive&&generation===this.generation&&this.kind)await this.load(true);
  }
  async choose(){if(this.exporting())return;this.status='';this.from='';this.to='';this.page=1;this.result.set(null);await this.load();}
  async load(reset=false){
    if(!this.kind||this.exporting())return;
    if(this.from&&this.to&&this.from>this.to){this.error.set('วันเริ่มต้องไม่อยู่หลังวันสิ้นสุด');return;}
    if(reset)this.page=1;const generation=++this.generation;const kind=this.kind,filters=this.filters(),key=this.filterKey();this.loading.set(true);this.error.set('');this.notice.set('');
    try{const result=await this.api.page(kind,filters);if(this.alive&&generation===this.generation){this.result.set(result);this.appliedFilters=key;}}
    catch(error){if(this.alive&&generation===this.generation){this.error.set(problemMessage(error));this.result.set(null);}}
    finally{if(this.alive&&generation===this.generation)this.loading.set(false);}
  }
  clear(){if(this.exporting())return;this.search='';this.status='';this.from='';this.to='';void this.load(true);}
  async changePage(change:number){const result=this.result();if(!result||this.loading()||this.exporting())return;const next=this.num(result.page)+change;if(next<1||(next-1)*this.pageSize>=this.num(result.total))return;this.page=next;await this.load();}
  async download(){
    const result=this.result();if(!result?.canExport||this.loading()||this.exporting()||this.filtersPending())return;
    this.exporting.set(true);this.error.set('');this.notice.set('');
    try{const blob=await this.api.download(result.kind,this.filters());if(!this.alive)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=result.kind+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.notice.set('ดาวน์โหลดรายงานตามตัวกรองแล้ว');}
    catch(error){if(this.alive)this.error.set(problemMessage(error));}
    finally{if(this.alive)this.exporting.set(false);}
  }
  value(row:ReportRow,column:ReportColumn){
    const value=row[column.key as keyof ReportRow];if(value===null||value===undefined)return '—';
    if(column.format==='status')return this.statuses[String(value)]??String(value);
    if(column.format==='date')return new Intl.DateTimeFormat('th-TH',{year:'numeric',month:'short',day:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(String(value)+'T00:00:00+07:00'));
    if(column.format==='number'||column.format==='money')return new Intl.NumberFormat('th-TH',{minimumFractionDigits:column.format==='money'?2:0,maximumFractionDigits:column.format==='money'?2:6}).format(Number(value));
    return String(value);
  }
  path(row:ReportRow){return row.route?.split('?')[0]??'';}
  query(row:ReportRow){return Object.fromEntries(new URLSearchParams(row.route?.split('?')[1]??''));}
}
