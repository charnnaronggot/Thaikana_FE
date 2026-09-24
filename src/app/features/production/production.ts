import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Badge, Feature, Overlay, StateMessage } from '../../shared/ui';
import { Assets } from '../../shared/assets';
import { STAGES, STAGE_LABELS, Stage, WorkOrder } from '../../domain/models';
import { discardProof, issueProof } from '../../core/credentials';
@Component({
  imports: [
    ReactiveFormsModule,
    Badge,
    Overlay,
    StateMessage,
    RouterLink,
    Assets,
    NgTemplateOutlet,
  ],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ station ? 'ST-LASER-01 / SHOP FLOOR' : 'PRODUCTION WORKSPACE' }}</p>
        <h1>{{ station ? 'Station Console' : 'Production Board' }}</h1>
        <p class="muted">
          {{
            station
              ? 'เลือก WO แล้วระบุผู้ทำงานจริง เครื่องจักร และผลแต่ละการ์ด'
              : 'ติดตามงานทุกขั้นตอนและสถานะ Operation แยกกัน'
          }}
        </p>
      </div>
      <div class="actions">
        <a routerLink="/inventory">คลังวัสดุ</a><a routerLink="/planning">Work Orders</a>
      </div>
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    @if (notice()) {
      <div class="notice success">{{ notice() }}</div>
    }
    @if (station && session.user()?.role !== 'Station') {
      <div class="notice error">
        ต้องเข้าสู่ระบบด้วย Station Account ก่อนใช้ Console <a routerLink="/login">เปลี่ยนบัญชี</a>
      </div>
    } @else {
      <section class="card">
        <div class="filter">
          <label class="search-field"
            >ค้นหา PO / WO / สินค้า<input
              [value]="query()"
              (input)="query.set($any($event.target).value)" /></label
          ><label
            >สถานะ<select [value]="status()" (change)="status.set($any($event.target).value)">
              <option value="">ทุกสถานะ</option>
              <option>Ready</option>
              <option>Running</option>
              <option>Paused</option>
              <option>QC</option>
              <option>Complete</option>
            </select></label
          ><label
            >Worker<select [value]="worker()" (change)="worker.set($any($event.target).value)">
              <option value="">ทุกคน</option>
              @for (u of store.state().users; track u.id) {
                @if (u.role === 'Operator') {
                  <option [value]="u.id">{{ u.name }}</option>
                }
              }
            </select></label
          >
        </div>
        @if (station) {
          <label
            >สแกน WO<input
              [value]="scan()"
              (input)="scan.set($any($event.target).value)"
              (keyup.enter)="lookup()"
              placeholder="WO-... แล้ว Enter" /></label
          ><button (click)="lookup()">ค้นหางาน</button>
        }
      </section>
      @if (station) {
        <div class="station-grid">
          @for (w of rows(); track w.id) {
            <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: w }" />
          } @empty {
            <div class="empty">ไม่พบงานในสถานีที่เลือก</div>
          }
        </div>
      } @else {
        <div class="board">
          @for (stage of stages; track stage) {
            <section class="board-column">
              <header>
                {{ labels[stage] }} <span>{{ count(stage) }}</span>
              </header>
              @for (w of rows(); track w.id) {
                @if (w.stage === stage) {
                  <ng-container
                    [ngTemplateOutlet]="card"
                    [ngTemplateOutletContext]="{ $implicit: w }"
                  />
                }
              }
            </section>
          }
          <section class="board-column">
            <header>
              QC <span>{{ countStatus('QC') }}</span>
            </header>
            @for (w of rows(); track w.id) {
              @if (w.status === 'QC') {
                <ng-container
                  [ngTemplateOutlet]="card"
                  [ngTemplateOutletContext]="{ $implicit: w }"
                />
              }
            }
          </section>
        </div>
      }
    }
    <ng-template #card let-w
      ><article class="job-card">
        <div class="section-heading">
          <strong>{{ w.number }}</strong
          ><app-badge [value]="w.status" />
        </div>
        <p>
          {{ w.snapshot.name }} <small> · {{ w.snapshot.code }} / R{{ w.snapshot.revision }}</small>
        </p>
        <dl class="key-value">
          <div>
            <dt>จำนวน</dt>
            <dd>{{ w.processQuantity }} / {{ w.quantity }} ชิ้น</dd>
          </div>
          <div>
            <dt>ขั้นตอน</dt>
            <dd>{{ stageName(w.stage) }}</dd>
          </div>
          <div>
            <dt>Worker</dt>
            <dd>{{ execution(w)?.workerId ? userName(execution(w)!.workerId) : 'ยังไม่เริ่ม' }}</dd>
          </div>
          <div>
            <dt>เครื่องจักร</dt>
            <dd>{{ execution(w)?.machine || '—' }}</dd>
          </div>
        </dl>
        @if (execution(w); as e) {
          <div class="job-timer">{{ elapsed(e) }}</div>
        }
        <div class="actions">
          @if (w.status === 'Ready' && (station || session.can('Operator'))) {
            <button class="primary shop-button" (click)="openAction(w, 'start')">Start</button>
          }
          @if (w.status === 'Running') {
            <button (click)="openAction(w, 'pause')">Pause</button
            ><button class="primary shop-button" (click)="openAction(w, 'complete')">
              Complete
            </button>
          }
          @if (w.status === 'Paused') {
            <button class="primary shop-button" (click)="openAction(w, 'resume')">Resume</button>
          }
          @if (w.status === 'Running' || w.status === 'Paused') {
            <button (click)="openAction(w, 'problem')">แจ้ง Problem</button>
          }
        </div>
      </article></ng-template
    >
    @if (action()) {
      <app-overlay [title]="title()" [dialog]="action() !== 'problem'" (close)="close()"
        ><section class="form-section">
          <h3>{{ target()?.number }} · {{ target()?.snapshot?.name }}</h3>
          <p class="muted">
            Operation {{ target()?.stage }} · Worker
            {{
              execution(target()!)?.workerId ? userName(execution(target()!)!.workerId) : 'รอระบุ'
            }}
            · Machine {{ execution(target()!)?.machine || 'รอเลือก' }}
          </p>
        </section>
        <form [formGroup]="form" class="form-grid">
          @if (action() === 'start') {
            <label class="wide"
              >เครื่องจักร<select formControlName="machine">
                <option>LASER-01</option>
                <option>LASER-02</option>
                <option>BEND-01</option>
                <option>WELD-01</option>
                <option>POLISH-01</option>
                <option>ASSEMBLY-01</option>
              </select></label
            >
          }
          @if (action() === 'pause' || action() === 'problem') {
            <label class="wide">เหตุผล<textarea formControlName="reason"></textarea></label>
          }
          @if (action() === 'problem') {
            <label class="wide"
              >สถานีปลายทาง<select formControlName="destination">
                @for (s of stages; track s) {
                  <option [value]="s">{{ labels[s] }}</option>
                }
              </select></label
            ><label class="wide">หมายเหตุ<textarea formControlName="note"></textarea></label
            ><app-assets [ids]="problemAssets()" (changed)="problemAssets.set($event)" />
          }
          @if (action() === 'complete') {
            <label>Good<input type="number" formControlName="good" /></label
            ><label>Reject<input type="number" formControlName="reject" /></label
            ><label>Scrap<input type="number" formControlName="scrap" /></label>
          }
          @if (station && action() !== 'problem') {
            <label class="wide"
              >Username ของผู้ทำงาน<input formControlName="username" autocomplete="off" /></label
            ><label class="wide"
              >{{ action() === 'start' || action() === 'resume' ? 'Password' : 'PIN'
              }}<input
                [type]="action() === 'start' || action() === 'resume' ? 'password' : 'password'"
                formControlName="secret"
                autocomplete="off"
                [class.pin-input]="action() === 'pause' || action() === 'complete'"
            /></label>
          }
        </form>
        <app-state [message]="error()" (retry)="store.refresh()" /><button footer (click)="close()">
          ยกเลิก</button
        ><button footer class="primary" (click)="submit()" [disabled]="busy()">
          ยืนยัน {{ action() }}
        </button></app-overlay
      >
    }
  `,
  styles: `
    .board {
      display: flex;
      gap: 14px;
      overflow-x: auto;
      padding-bottom: 16px;
    }
    .board-column {
      min-width: 300px;
      max-width: 300px;
      background: #e9edf2;
      border: 1px solid #d9dfe7;
      min-height: 480px;
    }
    .board-column > header {
      padding: 13px 14px;
      font-weight: 700;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
    }
    .board-column > header span {
      color: #68717d;
    }
    .job-card {
      margin: 0 9px 12px;
      padding: 15px;
      background: #fff;
      border: 1px solid #dee2e7;
    }
    .job-card p {
      margin: 0 0 15px;
    }
    .job-card p small {
      display: block;
      color: #68717d;
    }
    .job-card .key-value {
      gap: 9px;
    }
    .job-card .actions {
      margin-top: 16px;
    }
    .job-card button {
      font-size: 11px;
    }
    .job-timer {
      font-size: 22px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      margin-top: 13px;
    }
    .station-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 14px;
    }
    .station-grid .job-card {
      margin: 0;
      padding: 20px;
    }
    @media (max-width: 700px) {
      .board-column {
        min-width: 280px;
      }
      .station-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Production extends Feature {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  station = this.route.snapshot.data['station'] === true;
  stages = STAGES;
  labels = STAGE_LABELS;
  query = signal('');
  status = signal('');
  worker = signal('');
  scan = signal('');
  rows = computed(() =>
    this.store
      .state()
      .workOrders.filter(
        (w) =>
          w.status !== 'Cancelled' &&
          (!this.station || w.stage === 'laser') &&
          (
            w.number +
            ' ' +
            w.snapshot.name +
            ' ' +
            (this.store.state().orders.find((o) => o.id === w.orderId)?.po ?? '')
          )
            .toLowerCase()
            .includes(this.query().toLowerCase()) &&
          (!this.status() || w.status === this.status()) &&
          (!this.worker() || this.execution(w)?.workerId === this.worker()),
      ),
  );
  tick = signal(Date.now());
  private clock = setInterval(() => this.tick.set(Date.now()), 1000);
  ngOnDestroy() {
    clearInterval(this.clock);
  }
  execution(w: WorkOrder) {
    return [...this.store.state().executions]
      .reverse()
      .find((e) => e.woId === w.id && e.stage === w.stage);
  }
  elapsed(e: { elapsedMs: number; segmentStartedAt: string | null }) {
    const ms =
      e.elapsedMs + (e.segmentStartedAt ? this.tick() - Date.parse(e.segmentStartedAt) : 0);
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
      .map((x) => String(x).padStart(2, '0'))
      .join(':');
  }
  stageName(stage: string) {
    return this.labels[stage as Stage] ?? stage;
  }
  count(stage: Stage) {
    return this.rows().filter((w) => w.stage === stage && w.status !== 'QC').length;
  }
  countStatus(status: string) {
    return this.rows().filter((w) => w.status === status).length;
  }
  lookup() {
    const w = this.store.state().workOrders.find((w) => w.number === this.scan());
    if (!w || w.stage !== 'laser') {
      this.error.set('ไม่พบ WO ในคิว Station นี้');
      return;
    }
    this.query.set(w.number);
    this.error.set('');
  }
  action = signal('');
  target = signal<WorkOrder | null>(null);
  problemAssets = signal<string[]>([]);
  form = this.fb.nonNullable.group({
    machine: ['LASER-01'],
    reason: [''],
    destination: ['laser' as Stage],
    note: [''],
    good: [0, Validators.min(0)],
    reject: [0, Validators.min(0)],
    scrap: [0, Validators.min(0)],
    username: [''],
    secret: [''],
  });
  title() {
    return (
      {
        start: 'ยืนยันผู้ทำงานเพื่อ Start',
        pause: 'หยุดงานที่เลือก',
        resume: 'ยืนยันเพื่อทำงานต่อ',
        complete: 'Complete งานที่เลือก',
        problem: 'แจ้งปัญหาการผลิต',
      }[this.action()] ?? ''
    );
  }
  openAction(w: WorkOrder, a: string) {
    this.target.set(w);
    this.action.set(a);
    this.error.set('');
    this.problemAssets.set([]);
    const e = this.execution(w);
    this.form.reset({
      machine: w.stage.toUpperCase() + '-01',
      reason: '',
      destination: w.stage,
      note: '',
      good: w.processQuantity,
      reject: 0,
      scrap: 0,
      username: e
        ? (this.store.state().users.find((u) => u.id === e.workerId)?.username ?? '')
        : '',
      secret: '',
    });
    if (w.stage === 'laser') this.form.controls.machine.setValue('LASER-01');
  }
  close() {
    this.form.controls.secret.setValue('');
    this.action.set('');
  }
  async submit() {
    const w = this.target(),
      action = this.action();
    if (!w) return;
    const v = this.form.getRawValue();
    let proof: string | undefined;
    try {
      if (this.station && action !== 'problem') {
        try {
          proof = issueProof(
            this.store.state(),
            this.session.actor(),
            w.id,
            action,
            v.username,
            v.secret,
          );
        } catch (e) {
          if ((e as { code?: string }).code === 'pin') {
            const user = this.store.state().users.find((u) => u.username === v.username);
            if (user)
              await this.store.run('auth.pinFailure', { id: user.id }, this.session.actor());
          }
          throw e;
        }
      }
      let data: unknown = { woId: w.id, proof };
      let command = '';
      if (action === 'start') {
        command = 'execution.start';
        data = { woId: w.id, machine: v.machine, proof };
      }
      if (action === 'pause') {
        command = 'execution.pause';
        data = { woId: w.id, reason: v.reason, proof };
      }
      if (action === 'resume') command = 'execution.resume';
      if (action === 'complete') {
        command = 'execution.complete';
        data = { woId: w.id, good: v.good, reject: v.reject, scrap: v.scrap, proof };
      }
      if (action === 'problem') {
        command = 'production.problem';
        data = {
          woId: w.id,
          reason: v.reason,
          destination: v.destination,
          note: v.note,
          assetIds: this.problemAssets(),
        };
      }
      const ok = await this.run(command, data);
      if (ok) this.close();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      if (proof) discardProof(proof);
      this.form.controls.secret.setValue('');
    }
  }
}
