import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { problemMessage } from '../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../shared/components/ui';
@Component({
  imports: [ReactiveFormsModule, StateMessage, Drawer],
  template: `<div class="login-layout">
      <section class="login-brand">
        <strong>THAIKANA</strong>
        <div>
          <h1>จากใบเสนอราคา<br />ถึงส่งมอบ<br />อยู่ในที่เดียว</h1>
          <p>ติดตามแบบ ต้นทุน วัสดุ งานผลิต คุณภาพ และการจัดส่งด้วยข้อมูลอ้างอิงชุดเดียวกัน</p>
        </div>
        <small>© 2026 Thaikana · Production Tracking PWA</small>
      </section>
      <section class="login-side">
        <form class="login-card" [formGroup]="form" (ngSubmit)="login()">
          <p class="eyebrow">WELCOME BACK</p>
          <h2>เข้าสู่ระบบ</h2>
          <p class="muted">ใช้บัญชีพนักงานหรือบัญชีสถานีเพื่อเข้าสู่ระบบ</p>
          <label>USERNAME<input formControlName="username" autocomplete="username" /></label
          ><label
            >PASSWORD
            <div class="password-field">
              <input
                formControlName="password"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
              /><button
                type="button"
                aria-label="แสดงหรือซ่อนรหัสผ่าน"
                (click)="showPassword.set(!showPassword())"
              >
                <img src="/icons/fc491.svg" alt="" />
              </button></div
          ></label>
          <div class="login-options">
            <label class="check-label"
              ><input type="checkbox" formControlName="remember" />จดจำชื่อบัญชีนี้</label
            ><button type="button" class="text-button" (click)="help.set(true)">
              ลืมรหัสผ่าน?
            </button>
          </div>
          <app-state [error]="error()" /><button
            class="primary login-submit"
            [disabled]="busy() || form.invalid"
          >
            {{ busy() ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ →' }}
          </button>
        </form>
      </section>
    </div>
    @if (help()) {
      <app-overlay title="ขอรีเซ็ตรหัสผ่าน" [dialog]="true" (close)="help.set(false)"
        ><p>
          ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่านของบัญชีคุณ หลังเข้าสู่ระบบด้วยรหัสชั่วคราว
          ระบบจะให้ตั้งรหัสใหม่
        </p>
        <button footer (click)="help.set(false)">ปิด</button></app-overlay
      >
    }`,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  error = signal('');
  busy = signal(false);
  showPassword = signal(false);
  help = signal(false);
  form = this.fb.nonNullable.group({
    username: [localStorage.getItem('thaikana-username') ?? '', Validators.required],
    password: ['', Validators.required],
    remember: [false],
  });
  async login() {
    if (this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    try {
      const u = await this.auth.login(v.username, v.password);
      if (v.remember) localStorage.setItem('thaikana-username', v.username);
      else localStorage.removeItem('thaikana-username');
      await this.router.navigateByUrl(
        this.auth.pendingMfa()
          ? '/verify-mfa' +
              (this.route.snapshot.queryParamMap.get('returnUrl')
                ? '?returnUrl=' +
                  encodeURIComponent(this.route.snapshot.queryParamMap.get('returnUrl')!)
                : '')
          : u.mustChangePassword
            ? '/change-password'
            : this.auth.destination(this.route.snapshot.queryParamMap.get('returnUrl')),
      );
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.form.controls.password.setValue('');
      this.busy.set(false);
    }
  }
}
