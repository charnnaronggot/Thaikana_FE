import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { ModalScrollLock } from '../utils/modal-scroll-lock';
@Component({
  selector: 'app-badge',
  template:
    '<span class="badge" [class.good]="good()" [class.warn]="warn()" [class.bad]="bad()">{{value()}}</span>',
})
export class StatusBadge {
  value = input('');
  good = computed(() =>
    /^(Approved|Accepted|Complete|Completed|Delivered|Confirmed|Paid|ผ่าน)$/i.test(this.value()),
  );
  warn = computed(() =>
    /^(Paused|Pending|Draft|OnHold|Hold|Blocked|Rework|PartiallyPaid|รอ.*)$/i.test(this.value()),
  );
  bad = computed(() => /^(Rejected|Failed|Cancelled|Reversed|ไม่ผ่าน)$/i.test(this.value()));
}
@Component({
  selector: 'app-overlay',
  imports: [A11yModule],
  template: `<div class="scrim" (click)="attemptClose()"></div>
    <section
      class="overlay"
      [class.dialog]="dialog()"
      [class.form-dialog]="dialog() && size() === 'form'"
      [class.wide-dialog]="dialog() && size() === 'wide'"
      [class.compact-dialog]="density() === 'compact'"
      [class.dispatch-drawer]="dispatchLayout()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (keydown.escape)="onEscape($event)"
    >
      <header>
        <div>
          <h2>{{ title() }}</h2>
          <small>{{ reference() }}</small>
        </div>
        <button
          class="close-icon"
          aria-label="ปิด"
          [disabled]="closeBlocked()"
          type="button"
          (click)="attemptClose()"
        >
          <img src="/icons/drawer-close.svg" alt="" />
        </button>
      </header>
      <div class="overlay-body"><ng-content /></div>
      <footer><ng-content select="[footer]" /></footer>
    </section>`,
  styles: `
    .overlay {
      background: white;
      border-left: 5px solid var(--primary);
    }
    .overlay > header h2 {
      font-size: 18px;
      line-height: 28px;
      font-weight: 600;
      margin: 0 0 8px;
    }
    .overlay > header small {
      font-size: 12px;
      line-height: 18px;
      color: var(--muted);
    }
    .close-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      background: white;
    }
    .overlay > footer {
      gap: 8px;
      padding: 24px;
    }
    .overlay > header {
      padding: 24px;
    }
    .dispatch-drawer > header {
      padding: 28px 32px 24px;
    }
    .dispatch-drawer > header h2 {
      font-size: 26px;
      line-height: 36px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .dispatch-drawer > .overlay-body {
      padding: 20px 32px;
    }
    .dispatch-drawer > footer {
      padding: 24px 32px;
    }
    .dispatch-drawer > footer button:last-child {
      flex: 1;
    }
    .overlay.compact-dialog > header,
    .overlay.compact-dialog > footer {
      padding: 12px 16px;
    }
    .overlay.compact-dialog > header h2 {
      font-size: 16px;
      line-height: 24px;
      margin: 0 0 2px;
    }
    .overlay.compact-dialog > header small {
      font-size: 10px;
      line-height: 16px;
    }
    @media (min-width: 701px) {
      .overlay > header,
      .overlay > footer {
        padding: 16px;
      }
      .overlay > header h2 {
        font-size: 16px;
        line-height: 24px;
        margin-bottom: 4px;
      }
      .close-icon {
        min-width: 40px;
        width: 40px;
        height: 40px;
      }
      .dispatch-drawer > .overlay-body {
        padding: 16px;
      }
    }
    @media (max-width: 700px) {
      .overlay.compact-dialog > header,
      .overlay.compact-dialog > footer {
        padding: 12px;
      }
      .dispatch-drawer > header,
      .dispatch-drawer > footer {
        padding: 24px;
      }
      .dispatch-drawer > .overlay-body {
        padding: 20px;
      }
    }
  `,
})
export class Drawer {
  density = input<'default' | 'compact'>('default');
  constructor() {
    const scroll = inject(ModalScrollLock);
    scroll.acquire();
    inject(DestroyRef).onDestroy(() => scroll.release());
  }
  title = input('');
  reference = input('รายละเอียด');
  dialog = input(false);
  size = input<'compact' | 'form' | 'wide'>('compact');
  dispatchLayout = input(false);
  closeBlocked = input(false);
  close = output();
  attemptClose() {
    if (!this.closeBlocked()) this.close.emit();
  }
  onEscape(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.attemptClose();
  }
}
@Component({
  selector: 'app-state',
  template: `@if (loading()) {
      <div class="loading-state" role="status">
        <span class="loading-spinner" aria-hidden="true"></span>กำลังโหลดข้อมูล…
      </div>
    }
    @if (error()) {
      <div class="notice error" role="alert">
        <span>{{ error() }}</span>
        @if (retryable()) {
          <button type="button" (click)="retry.emit()">ลองอีกครั้ง</button>
        }
      </div>
    }
    @if (notice()) {
      <div class="notice success" role="status">{{ notice() }}</div>
    }`,
})
export class StateMessage {
  loading = input(false);
  error = input('');
  notice = input('');
  retryable = input(false);
  retry = output();
}
@Component({
  selector: 'app-scan-input',
  template: `<label
    >{{ label() }}
    <div class="scan-field">
      <input
        [attr.aria-label]="label()"
        [value]="value()"
        [disabled]="disabled()"
        (input)="value.set($any($event.target).value)"
        (keyup.enter)="scan()"
        [placeholder]="placeholder()"
        autocomplete="off"
      /><button [disabled]="disabled() || !value().trim()" (click)="scan()" type="button">
        {{ buttonLabel() }}
      </button>
    </div></label
  >`,
})
export class ScanInput {
  value = signal('');
  label = input('สแกนหรือค้นหา Work Order');
  placeholder = input('สแกน Barcode / WO แล้ว Enter');
  buttonLabel = input('ค้นหา');
  disabled = input(false);
  submit = output<string>();
  scan() {
    if (!this.disabled() && this.value().trim()) this.submit.emit(this.value().trim());
  }
}
