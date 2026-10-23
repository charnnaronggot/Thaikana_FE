import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { workspaceModules, canOpenModule } from '../auth/workspace-policy';
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: ` <div class="app-shell">
    <button
      class="mobile-menu floating-menu"
      (click)="menuOpen.set(!menuOpen())"
      aria-label="เปิดเมนู"
      aria-controls="main-sidebar"
      [attr.aria-expanded]="menuOpen()"
    >
      ☰
    </button>
    @if (menuOpen()) {
      <div class="navigation-scrim" (click)="menuOpen.set(false)"></div>
    }
    <aside id="main-sidebar" class="sidebar" [class.open]="menuOpen()">
      <a class="brand" routerLink="/">THAIKANA</a>
      <nav aria-label="เมนูหลัก">
        @for (item of visibleNav(); track item.path) {
          <a
            [routerLink]="item.path"
            [attr.aria-label]="item.label"
            [title]="item.label"
            routerLinkActive="active"
            (click)="menuOpen.set(false)"
            ><img [src]="'/icons/' + item.icon" alt="" /><span class="nav-text">{{
              item.label
            }}</span></a
          >
        }
      </nav>
      <div class="sidebar-bottom">
        <button class="logout" (click)="logout()">
          <img src="/icons/c7d65.svg" alt="" />ออกจากระบบ</button
        ><strong>{{ auth.user()?.displayName }}</strong
        ><small>{{
          auth.user()?.accountType === 'Station'
            ? 'Station account'
            : auth.user()?.roles?.join(' · ')
        }}</small>
      </div>
    </aside>
    <div class="workspace">
      <main id="main-content">
        @if (offline()) {
          <div class="notice error" role="status">ไม่มีการเชื่อมต่อ กรุณาออนไลน์ก่อนทำรายการ</div>
        }
        <router-outlet />
      </main>
      <nav class="footer-navigation" aria-label="เมนูมือถือ">
        @if (primaryNav(); as home) {
          <a [routerLink]="home.path" routerLinkActive="active">{{ home.label }}</a>
        }
        @if (stationNav(); as station) {
          <a [routerLink]="station.path" routerLinkActive="active">{{ station.label }}</a>
        }
        <button aria-controls="main-sidebar" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(true)">เมนู</button>
      </nav>
    </div>
  </div>`,
})
export class Shell {
  readonly offline = signal(!navigator.onLine);
  @HostListener('window:online') online() {
    this.offline.set(false);
  }
  @HostListener('window:offline') disconnected() {
    this.offline.set(true);
  }
  readonly auth = inject(AuthService);
  private router = inject(Router);
  menuOpen = signal(false);
  @HostListener('window:keydown.escape') closeNavigation(){this.menuOpen.set(false);}
  readonly visibleNav = computed(() =>
    this.auth.fullWorkspace
      ? workspaceModules.filter((m) => canOpenModule(this.auth.user(), m.key))
      : workspaceModules.filter(
          (m) =>
            ['sales', 'customers', 'settings'].includes(m.key) &&
            this.auth.user()?.accountType !== 'Station' &&
            this.auth.has(
              m.key === 'sales'
                ? 'quotation.view'
                : m.key === 'customers'
                  ? 'customer.view'
                  : 'settings.manage',
            ),
        ),
  );
  readonly primaryNav = computed(
    () => this.visibleNav().find((m) => m.path === this.auth.homePath()) ?? this.visibleNav()[0],
  );
  readonly stationNav = computed(() =>
    this.auth.fullWorkspace && this.primaryNav()?.path !== '/station'
      ? this.visibleNav().find((m) => m.path === '/station')
      : undefined,
  );
  async logout() {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
