import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { QualityApi } from '../services/quality-api.service';

type Queue = components['schemas']['QualityWorkspace'];
type Ready = components['schemas']['QualityQueueOperation'];
@Component({
  imports: [CommonModule, FormsModule, RouterLink, Drawer, StateMessage],
  providers: [MutationSession],
  templateUrl: './quality-workspace.component.html',
  styleUrl: './quality-workspace.component.scss',
})
export class QualityWorkspacePage {
  private api = inject(QualityApi);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  readonly command = inject(MutationSession);
  data = signal<Queue | null>(null);
  busy = signal(false);
  error = signal('');
  selected = signal<Ready | null>(null);
  discard = signal(false);
  formError = signal('');
  search = '';
  status = '';
  page = 1;
  quantity = 1;
  private initialQuantity = 1;
  private leave: ((ok: boolean) => void) | null = null;
  ngOnInit() {
    void this.load();
  }
  num(value: number | string | null | undefined) {
    return Number(value ?? 0);
  }
  async load(reset = false) {
    if (this.busy() || this.command.busy() || this.command.uncertain()) return;
    if (reset) this.page = 1;
    this.busy.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.workspace(this.search, this.status, this.page));
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  begin(row: Ready) {
    if (this.command.busy() || this.command.uncertain() || !row.canCreate) return;
    this.command.clear();
    this.formError.set('');
    this.quantity = this.num(row.available);
    this.initialQuantity = this.quantity;
    this.selected.set(row);
  }
  close() {
    if (this.command.busy() || this.command.uncertain()) return;
    if (this.quantity !== this.initialQuantity) this.discard.set(true);
    else this.selected.set(null);
  }
  confirmDiscard(ok: boolean) {
    this.discard.set(false);
    if (ok) this.selected.set(null);
    this.leave?.(ok);
    this.leave = null;
  }
  canLeave() {
    if (!this.selected()) return true;
    if (this.command.busy() || this.command.uncertain()) return false;
    if (!this.selected() || this.quantity === this.initialQuantity) return true;
    this.discard.set(true);
    return new Promise<boolean>((resolve) => (this.leave = resolve));
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.selected() || this.command.busy() || this.command.uncertain()) event.preventDefault();
  }
  async start() {
    const row = this.selected();
    if (!row || this.command.busy() || this.command.uncertain()) return;
    if (
      !Number.isFinite(this.quantity) ||
      this.quantity <= 0 ||
      this.quantity > this.num(row.available) ||
      Number(this.quantity.toFixed(6)) !== this.quantity
    ) {
      this.formError.set('ระบุจำนวนมากกว่าศูนย์ ไม่เกินจำนวนรอตรวจ และทศนิยมไม่เกิน6ตำแหน่ง');
      return;
    }
    this.formError.set('');
    await this.command.run<components['schemas']['QualityInspectionCreated']>(
      '/quality/inspections',
      { operationId: row.id, expectedVersion: row.version, quantity: this.quantity },
      async (result) => {
        this.selected.set(null);
        await this.router.navigate(['/qc/inspections', result.id]);
      },
    );
  }
  async reloadConflict() {
    if (this.command.busy() || this.command.uncertain()) return;
    const old = this.selected();
    this.command.clear();
    await this.load();
    if (old) {
      const row = this.data()?.ready.find((x) => x.id === old.id);
      if (row) this.selected.set(row);
      else {
        this.selected.set(null);
        this.error.set('งานนี้ไม่มีจำนวนรอตรวจแล้ว กรุณาเปิดรายการผลตรวจที่สร้างไว้');
      }
    }
  }
}
