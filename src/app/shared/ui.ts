import { Component, computed, Directive, inject, input, output, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { DemoStore } from '../data-access/demo-store';
import { Session } from '../core/session';
import { DomainError } from '../domain/models';
@Component({
  selector: 'app-badge',
  template: '<span class="badge" [class.good]="good()" [class.warn]="warn()">{{value()}}</span>',
})
export class Badge {
  value = input('');
  good = computed(() => /Approved|Accepted|Complete|Delivered|ผ่าน|พร้อม/.test(this.value()));
  warn = computed(() => /Paused|Pending|Draft|รอ|Rejected|Expired/.test(this.value()));
}
@Component({
  selector: 'app-overlay',
  imports: [A11yModule],
  template: ` <div class="scrim" (click)="close.emit()"></div>
    <section
      class="overlay"
      [class.dialog]="dialog()"
      [class.expanded]="expanded()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (keydown.escape)="close.emit()"
    >
      <header>
        <div>
          <small>{{ dialog() ? 'ยืนยันการทำรายการ' : 'THAIKANA / รายละเอียด' }}</small>
          <h2>{{ title() }}</h2>
        </div>
        <div class="actions">
          @if (!dialog()) {
            <button
              type="button"
              class="icon-button"
              (click)="expanded.set(!expanded())"
              aria-label="ขยายเต็มหน้า"
            >
              ↗
            </button>
          }
          <button type="button" class="icon-button" (click)="close.emit()" aria-label="ปิด">
            ×
          </button>
        </div>
      </header>
      <div class="overlay-body"><ng-content /></div>
      <footer><ng-content select="[footer]" /></footer>
    </section>`,
})
export class Overlay {
  title = input('');
  dialog = input(false);
  close = output();
  expanded = signal(false);
}
@Component({
  selector: 'app-state',
  template: `@if (message()) {
    <div class="notice error" role="alert">
      {{ message() }} <button type="button" (click)="retry.emit()">รีเฟรชข้อมูล</button>
    </div>
  }`,
})
export class StateMessage {
  message = input('');
  retry = output();
}
@Directive()
export abstract class Feature {
  readonly store = inject(DemoStore);
  readonly session = inject(Session);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly notice = signal('');
  async run<T = unknown>(type: string, data: unknown): Promise<T | undefined> {
    if (this.busy()) return undefined;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const result = await this.store.run<T>(type, data, this.session.actor());
      this.notice.set('บันทึกข้อมูลแล้ว');
      return result;
    } catch (e) {
      this.error.set(
        e instanceof DomainError ? e.message : 'บันทึกไม่สำเร็จ กรุณารีเฟรชและตรวจสอบก่อนลองใหม่',
      );
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
  money(value: number | null | undefined) {
    return value == null
      ? 'รอ Design'
      : new Intl.NumberFormat('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);
  }
  date(value: string) {
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(value));
  }
  userName(id: string) {
    return this.store.state().users.find((u) => u.id === id)?.name ?? id;
  }
  confirmClose(dirty: boolean) {
    return !dirty || confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการปิดโดยไม่บันทึกหรือไม่?');
  }
}
