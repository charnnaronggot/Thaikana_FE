import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MfaEnrollment } from '../../core/models/api.models';
import { problemMessage } from '../../core/services/api/api-client.service';
import { StateMessage } from '../../shared/components/ui';

@Component({
  imports: [ReactiveFormsModule, StateMessage, DatePipe],
  template: ` <main class="mfa-page">
    <section class="card mfa-card" aria-labelledby="mfa-heading">
      <p class="eyebrow">THAIKANA</p>
      @if (auth.recoveryCodes().length) {
        <h1 id="mfa-heading">เก็บรหัสสำรองของคุณ</h1>
        <p>
          ใช้รหัสเหล่านี้เมื่อเปิดแอป Authenticator ไม่ได้ แต่ละรหัสใช้ได้ครั้งเดียว
          และแสดงเฉพาะครั้งนี้
        </p>
        <ul class="recovery-codes" aria-label="รหัสสำรอง">
          @for (code of auth.recoveryCodes(); track code) {
            <li>
              <code>{{ code }}</code>
            </li>
          }
        </ul>
        <button type="button" (click)="copyCodes()">คัดลอกรหัสสำรอง</button>
        <label class="check-label"
          ><input
            type="checkbox"
            [checked]="saved()"
            (change)="saved.set(!saved())"
          />เก็บรหัสสำรองในที่ปลอดภัยแล้ว</label
        >
        <app-state [error]="error()" />
        <button class="primary" [disabled]="!saved()" (click)="continueToApp()">เข้าสู่ระบบ</button>
      } @else {
        <h1 id="mfa-heading">
          {{
            auth.pendingMfa()?.enrollmentRequired
              ? 'ตั้งค่าการยืนยันสองขั้นตอน'
              : 'ยืนยันตัวตนอีกขั้นตอน'
          }}
        </h1>
        @if (auth.pendingMfa()?.enrollmentRequired) {
          <p>
            สแกน QR ด้วยแอป Authenticator แล้วกรอกรหัส 6 หลักจากแอป เพื่อเปิดใช้การยืนยันสองขั้นตอน
          </p>
          @if (loading()) {
            <p role="status">กำลังเตรียมการตั้งค่า…</p>
          }
          @if (setup(); as enrollment) {
            @if (qr()) {
              <img
                class="qr"
                [src]="qr()"
                alt="QR สำหรับตั้งค่า Authenticator"
                width="224"
                height="224"
              />
            }
            <details>
              <summary>สแกนไม่ได้? ใช้รหัสตั้งค่าด้วยตนเอง</summary>
              <label
                >รหัสตั้งค่า<input
                  [value]="enrollment.sharedKey"
                  readonly
                  autocomplete="off"
                  spellcheck="false"
              /></label>
            </details>
          } @else if (!loading()) {
            <button type="button" (click)="loadSetup()">ลองเตรียมการตั้งค่าอีกครั้ง</button>
          }
        } @else {
          <p>
            {{
              recovery()
                ? 'กรอกรหัสสำรองที่ยังไม่เคยใช้'
                : 'กรอกรหัส 6 หลักจากแอป Authenticator ของคุณ'
            }}
          </p>
        }
        <form [formGroup]="form" (ngSubmit)="verify()">
          <label
            >{{ recovery() ? 'รหัสสำรอง' : 'รหัสจาก Authenticator' }}
            <input
              formControlName="code"
              [attr.inputmode]="recovery() ? 'text' : 'numeric'"
              [attr.maxlength]="recovery() ? 64 : 6"
              autocomplete="one-time-code"
              autocapitalize="off"
              spellcheck="false"
            />
          </label>
          <app-state [error]="error()" />
          <button
            class="primary"
            [disabled]="
              busy() ||
              loading() ||
              form.invalid ||
              (auth.pendingMfa()?.enrollmentRequired && !setup())
            "
          >
            {{ busy() ? 'กำลังตรวจสอบ…' : 'ยืนยันและเข้าสู่ระบบ' }}
          </button>
        </form>
        @if (!auth.pendingMfa()?.enrollmentRequired) {
          <button type="button" class="text-button" [disabled]="busy()" (click)="toggleRecovery()">
            {{ recovery() ? 'ใช้แอป Authenticator' : 'ใช้รหัสสำรองแทน' }}
          </button>
        }
        <p class="muted">
          คำขอนี้ใช้ได้ถึง {{ auth.pendingMfa()?.expiresAt | date: 'HH:mm' }} น.
          หากหมดอายุให้เข้าสู่ระบบใหม่
        </p>
        <button type="button" [disabled]="busy()" (click)="back()">กลับไปเข้าสู่ระบบ</button>
      }
    </section>
  </main>`,
  styles: `
    .mfa-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--surface-subtle, #f4f5f7);
    }
    .mfa-card {
      width: min(100%, 560px);
      padding: 28px;
      display: grid;
      gap: 16px;
    }
    .mfa-card h1 {
      font-size: 24px;
      margin: 0;
    }
    .mfa-card p {
      margin: 0;
      line-height: 1.7;
    }
    .eyebrow {
      color: #003b85;
      font-weight: 700;
      font-size: 13px;
    }
    .mfa-card form {
      display: grid;
      gap: 16px;
    }
    .mfa-card label {
      display: grid;
      gap: 8px;
    }
    .mfa-card .check-label {
      display: flex;
      align-items: flex-start;
    }
    .qr {
      display: block;
      margin: auto;
      max-width: 100%;
      height: auto;
    }
    .mfa-card summary {
      cursor: pointer;
    }
    .mfa-card details label {
      margin-top: 12px;
    }
    .recovery-codes {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 10px;
    }
    .recovery-codes code {
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .muted {
      font-size: 13px;
    }
    .mfa-card button {
      max-width: 100%;
    }
    @media (max-width: 600px) {
      .mfa-page {
        padding: 16px;
      }
      .mfa-card {
        padding: 20px;
      }
      .mfa-card h1 {
        font-size: 21px;
      }
    }
  `,
})
export class MfaComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly setup = signal<MfaEnrollment | null>(null);
  readonly qr = signal('');
  readonly recovery = signal(false);
  readonly saved = signal(false);
  async ngOnInit() {
    if (!this.auth.pendingMfa() && !this.auth.recoveryCodes().length) {
      await this.router.navigateByUrl('/login');
      return;
    }
    if (this.auth.pendingMfa()?.enrollmentRequired) await this.loadSetup();
  }
  async loadSetup() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const setup = await this.auth.enrollMfa();
      this.setup.set(setup);
      // Generate locally: never transmit the authenticator secret to a QR service.
      try {
        const { BrowserQRCodeSvgWriter } =
          await import('@zxing/library/esm/browser/BrowserQRCodeSvgWriter');
        const svg = new BrowserQRCodeSvgWriter().write(setup.authenticatorUri, 224, 224);
        this.qr.set('data:image/svg+xml;base64,' + btoa(svg.outerHTML));
      } catch {
        this.qr.set('');
      }
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  toggleRecovery() {
    this.recovery.set(!this.recovery());
    this.form.controls.code.setValidators(
      this.recovery()
        ? [Validators.required, Validators.maxLength(64)]
        : [Validators.required, Validators.pattern(/^\d{6}$/)],
    );
    this.form.controls.code.reset();
    this.form.controls.code.updateValueAndValidity();
    this.error.set('');
  }
  async verify() {
    if (this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.verifyMfa(this.form.controls.code.value, this.recovery());
      this.setup.set(null);
      this.qr.set('');
      if (!this.auth.recoveryCodes().length) await this.continueToApp();
    } catch (e) {
      const code = (e as { error?: { code?: string } })?.error?.code;
      this.error.set(
        code === 'mfa_invalid'
          ? 'รหัสไม่ถูกต้อง ถูกใช้แล้ว หรือคำขอหมดอายุ หากกรอกผิดครบ 5 ครั้งต้องรอ 15 นาที แล้วเข้าสู่ระบบใหม่'
          : problemMessage(e),
      );
    } finally {
      this.form.controls.code.reset();
      this.busy.set(false);
    }
  }
  async copyCodes() {
    try {
      await navigator.clipboard.writeText(this.auth.recoveryCodes().join('\n'));
    } catch {
      this.error.set('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง');
    }
  }
  async continueToApp() {
    this.auth.recoveryCodes.set([]);
    await this.router.navigateByUrl(
      this.auth.destination(this.route.snapshot.queryParamMap.get('returnUrl')),
    );
  }
  async back() {
    this.auth.clear();
    await this.router.navigateByUrl('/login');
  }
}
