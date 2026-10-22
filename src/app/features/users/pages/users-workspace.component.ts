import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import {
  ManagedUser,
  roleLabels,
  UserAction,
  UserDetail,
  UserOptions,
  UserMutationRequest,
} from '../models/user.models';
import { UsersApi } from '../services/users-api.service';

@Component({
  imports: [CommonModule, FormsModule, Drawer, StateMessage],
  providers: [MutationSession],
  templateUrl: './users-workspace.component.html',
  styleUrl: './users-workspace.component.scss',
})
export class UsersWorkspace {
  readonly auth = inject(AuthService);
  readonly command = inject(MutationSession);
  private api = inject(UsersApi);
  readonly rows = signal<ManagedUser[]>([]);
  readonly options = signal<UserOptions | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly detailError = signal('');
  readonly notice = signal('');
  readonly selected = signal<UserDetail | null>(null);
  readonly action = signal<UserAction | null>(null);
  readonly discard = signal(false);
  readonly formError = signal('');
  fieldErrors: Record<string, string[]> = {};
  total = 0;
  page = 1;
  search = '';
  role = '';
  active = '';
  accountType = '';
  private generation = 0;
  private detailGeneration = 0;
  private baseline = '';
  private mfaVersion: number | string = 0;
  model = this.empty();
  readonly labels = roleLabels;
  readonly titles: Record<UserAction, string> = {
    create: 'สร้างบัญชีผู้ใช้',
    profile: 'แก้ข้อมูลบัญชี',
    assignments: 'กำหนด Role และสถานี',
    status: 'เปลี่ยนสถานะบัญชี',
    'reset-password': 'รีเซ็ตรหัสผ่าน',
    pin: 'ตั้ง / รีเซ็ต PIN',
    'revoke-sessions': 'ออกจากระบบทุกอุปกรณ์',
    mfa: 'รีเซ็ต Authenticator MFA',
    unlock: 'ปลดล็อกบัญชี',
  };
  private empty() {
    return {
      username: '',
      email: '',
      employeeCode: '',
      displayName: '',
      temporaryPassword: '',
      accountType: 'HUMAN',
      stationId: '',
      roles: [] as string[],
      workCenterIds: [] as string[],
      pin: '',
      reason: '',
    };
  }
  ngOnInit() {
    void this.load();
  }
  get blocked() {
    return this.command.busy() || this.command.uncertain();
  }
  get dirty() {
    return !!this.action() && JSON.stringify(this.model) !== this.baseline;
  }
  canLeave() {
    if (this.blocked) return false;
    if (this.dirty) {
      this.discard.set(true);
      return false;
    }
    return true;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.blocked || this.dirty) event.preventDefault();
  }
  async load() {
    if (this.loading() || this.blocked) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const [data, options] = await Promise.all([
        this.api.list({
          page: this.page,
          pageSize: 25,
          search: this.search.trim(),
          role: this.role || undefined,
          isActive: this.active === '' ? undefined : this.active === 'true',
          accountType: this.accountType || undefined,
        }),
        this.api.options(),
      ]);
      if (generation === this.generation) {
        this.rows.set(data.items);
        this.total = data.totalCount;
        this.options.set(options);
      }
    } catch (e) {
      if (generation === this.generation) this.error.set(problemMessage(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  filter() {
    this.page = 1;
    void this.load();
  }
  clear() {
    this.search = '';
    this.role = '';
    this.active = '';
    this.accountType = '';
    this.filter();
  }
  paginate(delta: number) {
    this.page += delta;
    void this.load();
  }
  async open(user: ManagedUser) {
    if (this.blocked) return;
    const generation = ++this.detailGeneration;
    this.detailLoading.set(true);
    this.detailError.set('');
    this.selected.set(null);
    try {
      const detail = await this.api.detail(user.id);
      if (generation === this.detailGeneration) this.selected.set(detail);
    } catch (e) {
      if (generation === this.detailGeneration) this.detailError.set(problemMessage(e));
    } finally {
      if (generation === this.detailGeneration) this.detailLoading.set(false);
    }
  }
  closeDetail() {
    if (this.blocked || this.action()) return;
    ++this.detailGeneration;
    this.selected.set(null);
    this.detailError.set('');
    this.detailLoading.set(false);
  }
  async begin(action: UserAction) {
    if (this.blocked || this.action()) return;
    const d = this.selected();
    const allowed =
      action === 'create'
        ? this.options()?.canProvision
        : !!d &&
          {
            profile: d.capabilities.canEdit,
            assignments: d.capabilities.canAssign,
            status: d.capabilities.canChangeStatus,
            'reset-password': d.capabilities.canResetPassword,
            pin: d.capabilities.canSetPin,
            'revoke-sessions': d.capabilities.canRevokeSessions,
            mfa: d.capabilities.canResetMfa,
            unlock: d.capabilities.canUnlock,
          }[action];
    if (!allowed) return;
    this.command.clear();
    this.model = this.empty();
    this.fieldErrors = {};
    this.formError.set('');
    if (d && action !== 'create') {
      const u = d.user;
      this.model = {
        ...this.model,
        username: u.username,
        email: u.email,
        employeeCode: u.employeeCode,
        displayName: u.displayName,
        accountType: u.accountType,
        stationId: u.stationId ?? '',
        roles: [...u.roles],
        workCenterIds: [...u.workCenterIds],
      };
    }
    if (action === 'mfa') {
      const generation = this.detailGeneration;
      this.detailLoading.set(true);
      try {
        this.mfaVersion = (await this.api.mfa(d!.user.id)).version;
        if (generation !== this.detailGeneration) return;
      } catch (e) {
        if (generation === this.detailGeneration) this.detailError.set(problemMessage(e));
        return;
      } finally {
        if (generation === this.detailGeneration) this.detailLoading.set(false);
      }
    }
    this.baseline = JSON.stringify(this.model);
    this.action.set(action);
  }
  accountChanged() {
    this.model.roles = this.model.accountType === 'STATION' ? ['Station'] : [];
    this.model.stationId = '';
    this.model.workCenterIds = [];
  }
  stationChanged() {
    if (this.model.accountType === 'STATION')
      this.model.workCenterIds = this.model.stationId ? [this.model.stationId] : [];
  }
  toggle(key: 'roles' | 'workCenterIds', value: string) {
    const rows = this.model[key];
    this.model[key] = rows.includes(value) ? rows.filter((x) => x !== value) : [...rows, value];
  }
  roleName(role: string) {
    return this.labels[role] ?? role;
  }
  roleNames(roles: string[]) {
    return roles.map((r) => this.roleName(r)).join(', ');
  }
  errors(key: string) {
    return (
      this.fieldErrors[key] ??
      this.command.fieldErrors()[key] ??
      this.command.fieldErrors()[key[0].toUpperCase() + key.slice(1)] ??
      []
    ).join(' · ');
  }
  ObjectKeysErrors() {
    return Object.keys(this.fieldErrors).length > 0;
  }
  unavailableAssignments() {
    return this.model.workCenterIds.filter(
      (id) => !this.options()?.stations.some((s) => s.id === id),
    );
  }
  stationNames(user: ManagedUser) {
    return (
      user.workCenterIds
        .map((id) => {
          const s = this.options()?.stations.find((s) => s.id === id);
          return s ? s.code + ' · ' + s.name : 'สถานีที่มอบหมาย';
        })
        .join(', ') || 'ยังไม่กำหนด'
    );
  }
  closeForm() {
    if (this.blocked) return;
    if (this.dirty) this.discard.set(true);
    else this.finishClose();
  }
  finishClose() {
    this.action.set(null);
    this.discard.set(false);
    this.model = this.empty();
    this.fieldErrors = {};
    this.formError.set('');
  }
  validate() {
    const a = this.action(),
      m = this.model;
    this.fieldErrors = {};
    const required = (key: keyof typeof m, message: string) => {
      if (!String(m[key]).trim()) this.fieldErrors[key] = [message];
    };
    if (a === 'create' || a === 'profile') {
      required('email', 'กรอกอีเมลบัญชี');
      if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email))
        this.fieldErrors['email'] = ['รูปแบบอีเมลไม่ถูกต้อง'];
      required('employeeCode', 'กรอกรหัสพนักงานหรือรหัสบัญชี');
      required('displayName', 'กรอกชื่อที่แสดง');
    }
    if (a === 'create') {
      required('username', 'กรอก Username');
      if (m.username && !/^[A-Za-z0-9._-]{3,64}$/.test(m.username))
        this.fieldErrors['username'] = ['ใช้ A–Z, 0–9, จุด, ขีดกลาง หรือ _ จำนวน 3–64 ตัว'];
    }
    if (a === 'create' || a === 'reset-password') {
      if (m.temporaryPassword.length < 12 || m.temporaryPassword.length > 128)
        this.fieldErrors['temporaryPassword'] = [
          'ใช้รหัสชั่วคราว 12–128 ตัว พร้อมตัวใหญ่ ตัวเล็ก ตัวเลขและสัญลักษณ์',
        ];
    }
    if (a === 'create' || a === 'assignments') {
      if (!m.roles.length) this.fieldErrors['roles'] = ['เลือกอย่างน้อยหนึ่ง Role'];
      if (m.accountType === 'STATION' && !m.stationId)
        this.fieldErrors['stationId'] = ['เลือกสถานีประจำบัญชี'];
    }
    if (a === 'pin' && !/^\d{6}$/.test(m.pin))
      this.fieldErrors['pin'] = ['PIN ต้องเป็นตัวเลข 6 หลัก'];
    if (
      a !== 'create' &&
      a !== 'profile' &&
      (m.reason.trim().length < 3 || m.reason.trim().length > 500)
    )
      this.fieldErrors['reason'] = ['กรอกเหตุผล 3–500 ตัวอักษร'];
    return Object.keys(this.fieldErrors).length === 0;
  }
  async save() {
    if (this.blocked || !this.validate()) return;
    const a = this.action()!,
      m = this.model,
      d = this.selected();
    const version = d?.user.version ?? null;
    const reason = m.reason.trim();
    let path = '/users';
    let body: UserMutationRequest;
    if (a === 'create')
      body = {
        username: m.username.trim(),
        email: m.email.trim(),
        employeeCode: m.employeeCode.trim(),
        displayName: m.displayName.trim(),
        departmentId: null,
        stationId: m.stationId || null,
        roles: m.roles,
        temporaryPassword: m.temporaryPassword,
        accountType: m.accountType,
        workCenterIds: m.workCenterIds,
      };
    else {
      path += '/' + d!.user.id + '/' + a;
      body = { expectedVersion: version, reason };
      if (a === 'profile')
        body = {
          email: m.email.trim(),
          employeeCode: m.employeeCode.trim(),
          displayName: m.displayName.trim(),
          expectedVersion: version,
        };
      if (a === 'assignments')
        body = {
          expectedVersion: version,
          reason,
          roles: m.roles,
          workCenterIds: m.workCenterIds,
          stationId: m.stationId || null,
        };
      if (a === 'status') body = { expectedVersion: version, reason, isActive: !d!.user.isActive };
      if (a === 'reset-password')
        body = { expectedVersion: version, reason, temporaryPassword: m.temporaryPassword };
      if (a === 'pin') body = { expectedVersion: version, reason, pin: m.pin };
      if (a === 'mfa') {
        path = '/auth/mfa/users/' + d!.user.id + '/reset';
        body = { expectedVersion: this.mfaVersion, reason };
      }
    }
    this.formError.set('');
    await this.command.run(path, body, async (result) => {
      this.finishClose();
      this.notice.set('บันทึกแล้ว · ' + this.titles[a]);
      // The committed command is confirmed before refreshing; a read failure must not resend it.
      if (d && a !== 'create') {
        try {
          this.selected.set(await this.api.detail(d.user.id));
        } catch (e) {
          this.selected.set(null);
          this.detailError.set('บันทึกแล้ว แต่โหลดรายละเอียดไม่ได้ · ' + problemMessage(e));
        }
      }
      this.page = 1;
    });
    if (!this.command.uncertain() && !this.action()) {
      await this.load();
    }
  }
  async retry() {
    await this.command.retry();
    if (!this.command.uncertain() && !this.action()) await this.load();
  }
  async reloadConflict() {
    if (this.blocked) return;
    const u = this.selected()?.user;
    this.finishClose();
    if (u) await this.open(u);
  }
}
