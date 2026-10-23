import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient, problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { NativeApi } from '../../modules/native-api.service';

type Work = components['schemas']['StationWork'];
type Workspace = components['schemas']['StationWorkspace'];
type History = components['schemas']['StationHistory'];
type Action = 'START' | 'PAUSE' | 'RESUME' | 'COMPLETE';
@Component({
  imports: [CommonModule, FormsModule, Drawer, StateMessage], providers: [MutationSession],
  templateUrl: './station-workspace.component.html', styleUrl: './station-workspace.component.scss',
})
export class StationWorkspace {
  readonly auth = inject(AuthService);
  readonly command = inject(MutationSession);
  private api = inject(ApiClient);
  private native = inject(NativeApi);
  data = signal<Workspace | null>(null);
  loading = signal(false); error = signal(''); notice = signal('');
  action = signal<Action | null>(null); selected = signal<Work | null>(null);
  history = signal<History | null>(null); historyWork = signal<Work | null>(null);
  historyBusy = signal(false); historyError = signal(''); discard = signal(false);
  verifying = signal(false); formError = signal(''); formCode = signal(''); fields = signal<Record<string,string>>({});
  view = signal<'board' | 'list'>('board');
  page = 1; stationId = ''; search = ''; status = '';
  model = this.empty(); private baseline = ''; private generation = 0;
  readonly statuses = [{value:'',label:'ทุกสถานะ'},{value:'WAITING',label:'รอขั้นก่อน'},{value:'READY',label:'พร้อมเริ่ม'},{value:'IN_PROGRESS',label:'กำลังทำ'},{value:'PAUSED',label:'พัก'},{value:'COMPLETED',label:'จบขั้นตอน'}];
  readonly titles: Record<Action,string> = {START:'เริ่มงาน',PAUSE:'พักงาน',RESUME:'ทำต่อ',COMPLETE:'จบรอบผลิต'};
  private empty() { return {username:'',secret:'',quantity:1,good:0,reject:0,scrap:0,remark:'',delegated:false}; }
  num(value: number|string|null|undefined) { return Number(value ?? 0); }
  ngOnInit() { void this.load(); }
  canLeave() { return !this.verifying() && !this.command.busy() && !this.command.uncertain() && (!this.action() || JSON.stringify(this.model) === this.baseline || window.confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?')); }
  @HostListener('window:beforeunload',['$event']) beforeUnload(event: BeforeUnloadEvent) { if (this.action() || this.command.uncertain() || this.command.busy()) event.preventDefault(); }
  blocked() { return this.loading() || this.verifying() || this.command.busy() || this.command.uncertain(); }
  async load(reset = false, committed = false) {
    if (this.action() || !committed && (this.command.busy() || this.command.uncertain())) return;
    if (reset) this.page = 1;
    const generation = ++this.generation; this.loading.set(true); this.error.set('');
    try {
      const query: Record<string,string|number> = {page:this.page,pageSize:50};
      if (this.stationId) query['stationId'] = this.stationId;
      if (this.search.trim()) query['search'] = this.search.trim();
      if (this.status) query['status'] = this.status;
      const data = await this.native.get<Workspace>('/station/workspace',query);
      if (generation === this.generation) this.data.set(data);
    } catch(e) { if (generation === this.generation) this.error.set(problemMessage(e)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  reset() { this.stationId = ''; this.search = ''; this.status = ''; void this.load(true); }
  cards(station: string) { return this.data()?.items.filter(x => x.stationId === station) ?? []; }
  columns() { return this.data()?.stations.filter(x => !this.stationId || x.id === this.stationId) ?? []; }
  boardColumns() {
    const stations = this.columns(), items = this.data()?.items ?? [];
    return stations.length === 1
      ? ['READY','IN_PROGRESS','PAUSED','WAITING','COMPLETED'].map(id => ({id,name:this.statusText(id),items:items.filter(x => x.status === id)}))
      : stations.map(station => ({id:station.id,name:station.name,items:this.cards(station.id)}));
  }
  statusText(value: string) { return this.statuses.find(x => x.value === value)?.label ?? value; }
  inputLabel(work: Work) { return work.execution ? 'input รอบนี้' : 'input พร้อมใช้'; }
  blockerText(code: string) { return ({process_required:'Planner ต้องกำหนดขั้นตอน',process_review_required:'รอ Planner ตรวจขั้นตอน',planned_start_required:'รอกำหนดวันเริ่ม',material_reservation_shortage:'จองวัสดุยังไม่ครบ',material_not_issued:'รอคลังเบิกวัสดุจริง',inactive_plant:'โรงงานปิดใช้งาน',design_not_ready:'รอแบบที่เผยแพร่แล้ว',inactive_station:'สถานีปิดใช้งาน',legacy_execution_review_required:'ประวัติงานเดิมต้องตรวจสอบ',predecessor_not_ready:'รอจำนวนจากขั้นก่อน'} as Record<string,string>)[code] ?? code; }
  next(work: Work) { return work.canStart ? 'ผู้ทำงานเริ่มงานได้' : work.canResume ? 'ผู้ทำงานทำต่อได้' : work.canComplete ? 'ผู้ทำงานบันทึกผลรอบนี้' : work.status === 'COMPLETED' ? 'ส่งต่อขั้นถัดไป / QC' : work.blockers.length ? this.blockerText(work.blockers[0]) : work.execution ? 'ผู้ทำงานหรือหัวหน้างานดำเนินการ' : 'รอ Planner ตรวจความพร้อม'; }
  begin(work: Work, action: Action) {
    if (this.blocked() || this.action()) return;
    this.command.clear(); this.formError.set(''); this.formCode.set(''); this.fields.set({}); this.notice.set(''); this.selected.set(work); this.action.set(action);
    const delegated = this.auth.user()?.accountType !== 'Station' && !!work.execution && work.execution.ownerId !== this.auth.user()?.id;
    this.model = {...this.empty(),username:this.auth.user()?.accountType === 'Station' ? work.execution?.ownerUsername ?? '' : this.auth.user()?.username ?? '',quantity:this.num(action === 'RESUME' ? work.execution?.input : work.availableInput),good:this.num(work.execution?.input),delegated};
    this.baseline = JSON.stringify(this.model);
  }
  isStation() { return this.auth.user()?.accountType === 'Station'; }
  needsSecret() { return this.isStation() || this.model.delegated; }
  isPassword() { return this.action() === 'START'; }
  readonly quantityLabel = 'จำนวนเริ่มรอบ';
  readonly statusLabel = 'สถานะ';
  readonly stationLabel = 'สถานี';
  usernameLabel() { return this.model.delegated ? 'บัญชีหัวหน้างาน' : 'บัญชีผู้ทำงาน'; }
  secretLabel() { return this.isPassword() ? 'รหัสผ่าน Worker' : 'PIN ผู้ทำรายการ (6 หลัก)'; }
  remarkLabel() { return this.model.delegated || this.action() === 'COMPLETE' && this.unprocessed() > 0 ? 'เหตุผล (จำเป็น)' : 'หมายเหตุ'; }
  changeDelegate() { this.model.username = this.model.delegated ? '' : this.selected()?.execution?.ownerUsername ?? ''; this.model.secret = ''; }
  close() {
    if (this.verifying() || this.command.busy() || this.command.uncertain()) return;
    if (JSON.stringify(this.model) !== this.baseline) this.discard.set(true); else this.abandon();
  }
  abandon() { this.model.secret = ''; this.discard.set(false); this.action.set(null); this.selected.set(null); this.command.clear(); }
  unprocessed() { return Math.max(0,this.num(this.selected()?.execution?.input)-this.num(this.model.good)-this.num(this.model.reject)-this.num(this.model.scrap)); }
  async save() {
    const work = this.selected(), action = this.action();
    if (!work || !action || this.blocked()) return;
    const fields: Record<string,string> = {};
    if (this.isStation() && !this.model.username.trim()) fields['username'] = 'ระบุบัญชีผู้ทำรายการ';
    if (this.needsSecret() && (!this.model.secret || !this.isPassword() && !/^\d{6}$/.test(this.model.secret))) fields['secret'] = this.isPassword() ? 'ระบุรหัสผ่านของ Worker' : 'ระบุ PIN 6 หลักของผู้ทำรายการ';
    if (action === 'START' && (!Number.isFinite(this.model.quantity) || this.model.quantity <= 0 || this.model.quantity > this.num(work.availableInput))) fields['quantity'] = 'จำนวนต้องมากกว่าศูนย์และไม่เกิน input พร้อมใช้';
    if (action === 'COMPLETE') {
      const quantities = [this.model.good,this.model.reject,this.model.scrap];
      if (quantities.some(x => !Number.isFinite(x) || x < 0) || quantities.reduce((a,b) => a+b,0) > this.num(work.execution?.input)) fields['quantities'] = 'จำนวนต้องไม่ติดลบ และรวมไม่เกิน input ของรอบนี้';
      if (this.unprocessed() > 0 && !this.model.remark.trim()) fields['remark'] = 'ระบุเหตุผลที่จบรอบโดยยังผลิตไม่ครบ';
    }
    if (this.model.delegated && !this.model.remark.trim()) fields['remark'] = 'ระบุเหตุผลที่หัวหน้างานทำแทน';
    this.fields.set(fields); this.formError.set(''); if (Object.keys(fields).length) return;
    this.verifying.set(true);
    let proof: components['schemas']['StationVerification'];
    try {
      proof = await this.api.post('/action-verifications',{operationId:work.operationId,action,executionId:work.execution?.id ?? null,expectedVersion:work.version,username:this.model.username.trim() || null,secret:this.needsSecret() ? this.model.secret : null,reason:this.model.delegated ? this.model.remark.trim() : null} satisfies components['schemas']['VerificationRequest']);
      this.model.secret = '';
    } catch(e) {
      this.formCode.set(e instanceof HttpErrorResponse ? e.error?.code ?? '' : '');
      this.formError.set(this.formCode() === 'invalid_credentials' ? 'บัญชี รหัสผ่าน หรือ PIN ไม่ถูกต้อง หรือถูกล็อกชั่วคราว · PIN ผิด 5 ครั้งล็อก 15 นาที' : problemMessage(e));
      this.model.secret = ''; return;
    }
    finally { this.verifying.set(false); }
    const base = {verificationId:proof.verificationId,expectedVersion:proof.version,executionId:proof.executionId};
    const body = action === 'START' || action === 'RESUME' ? {...base,machineId:null,quantity:action === 'RESUME' ? this.num(work.execution?.input) : this.model.quantity} satisfies components['schemas']['StartOperation']
      : action === 'PAUSE' ? {...base,remark:this.model.remark.trim() || null} satisfies components['schemas']['PauseOperation']
      : {...base,good:this.model.good,reject:this.model.reject,scrap:this.model.scrap,remark:this.model.remark.trim() || null} satisfies components['schemas']['CompleteOperation'];
    await this.command.run('/operations/'+work.operationId+'/'+action.toLowerCase(),body,async () => {
      this.notice.set(this.titles[action]+'สำเร็จ · '+work.workOrderNo);
      this.action.set(null); this.selected.set(null); this.model.secret = ''; await this.load(false,true);
    });
  }
  async openHistory(work: Work) {
    if (this.action() || this.blocked()) return;
    this.historyWork.set(work); this.history.set(null); this.historyBusy.set(true); this.historyError.set('');
    try { const history = await this.native.get<History>('/station/operations/'+work.operationId+'/history'); if (this.historyWork()?.operationId === work.operationId) this.history.set(history); }
    catch(e) { this.historyError.set(problemMessage(e)); } finally { this.historyBusy.set(false); }
  }
  async refreshAfterConflict() { if (this.command.uncertain() || this.command.busy()) return; this.abandon(); await this.load(); }
  eventText(type: string) { return ({START:'เริ่ม',PAUSE:'พัก',RESUME:'ทำต่อ',COMPLETE:'จบรอบ'} as Record<string,string>)[type] ?? type; }
}
