import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideLayoutDashboard,
  LucideFileText,
  LucidePencilRuler,
  LucideCalendarDays,
  LucideFactory,
  LucidePackage,
  LucideClipboardCheck,
  LucideTruck,
  LucideUsers,
  LucideMonitor,
  LucideMenu,
} from '@lucide/angular';
import { DemoStore } from './data-access/demo-store';
import { Session } from './core/session';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideDynamicIcon],
  template: ` <div class="app-shell">
    <aside class="sidebar" [class.open]="menuOpen()">
      <a routerLink="/" class="brand">THAIKANA<span>PRODUCTION SYSTEM</span></a>
      <p class="nav-label">WORKSPACE</p>
      <nav>
        @for (item of nav; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.path === '/' }"
            (click)="menuOpen.set(false)"
            ><svg [lucideIcon]="item.icon" [size]="19"></svg>{{ item.label }}</a
          >
        }
      </nav>
      <div class="sidebar-bottom">
        <span class="online-dot"></span> โรงงานหลัก · กรุงเทพฯ<small
          >Production management · Demo</small
        >
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <button class="mobile-menu" (click)="menuOpen.set(!menuOpen())" aria-label="เปิดเมนู">
          <svg [lucideIcon]="menuIcon" [size]="20"></svg></button
        ><span class="breadcrumb">Thaikana <span>/</span> ระบบบริหารการผลิต</span>
        <div class="top-actions">
          <span class="demo-pill">โหมดตัวอย่าง</span
          ><button class="text-button" (click)="reset()">Reset Demo</button
          ><a routerLink="/login" class="account"
            ><span class="avatar">{{ session.user()?.name?.slice(0, 1) || 'T' }}</span
            ><span
              >{{ session.user()?.name || 'เข้าสู่ระบบ'
              }}<small>{{ session.user()?.role || 'Demo workspace' }}</small></span
            ></a
          >
        </div>
      </header>
      @if (store.changed()) {
        <div class="notice warning">
          มีข้อมูลใหม่จากอีกหน้าต่าง <button (click)="store.refresh()">รีเฟรชข้อมูล</button>
        </div>
      }
      @if (store.error()) {
        <div class="notice error" role="alert">
          {{ store.error() }} <button (click)="store.refresh()">ลองใหม่</button>
        </div>
      }
      <main id="main-content">
        @if (!store.ready()) {
          <div class="empty" role="status">กำลังโหลดข้อมูล Demo…</div>
        } @else {
          <router-outlet />
        }
      </main>
      <footer class="app-footer">
        THAIKANA <span>ข้อมูลตัวอย่างสำหรับตรวจ Flow · ไม่มีการเชื่อมต่อ API</span>
      </footer>
    </div>
  </div>`,
})
export class App {
  store = inject(DemoStore);
  session = inject(Session);
  menuOpen = signal(false);
  menuIcon = LucideMenu;
  nav = [
    { path: '/', label: 'ภาพรวม', icon: LucideLayoutDashboard },
    { path: '/sales', label: 'งานขาย', icon: LucideFileText },
    { path: '/design', label: 'ออกแบบ', icon: LucidePencilRuler },
    { path: '/planning', label: 'วางแผนผลิต', icon: LucideCalendarDays },
    { path: '/production', label: 'งานผลิต', icon: LucideFactory },
    { path: '/station', label: 'Station Console', icon: LucideMonitor },
    { path: '/qc', label: 'ตรวจคุณภาพ', icon: LucideClipboardCheck },
    { path: '/inventory', label: 'คลังสินค้า', icon: LucidePackage },
    { path: '/delivery', label: 'จัดส่ง', icon: LucideTruck },
    { path: '/documents', label: 'เอกสาร', icon: LucideFileText },
    { path: '/users', label: 'ผู้ใช้และสิทธิ์', icon: LucideUsers },
  ];
  async reset() {
    if (confirm('ล้างข้อมูล Demo ทั้งหมดและกลับเป็นชุดเริ่มต้น?')) {
      await this.store.reset();
      this.session.logout();
    }
  }
}
