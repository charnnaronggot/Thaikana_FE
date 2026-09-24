import { computed, inject, Injectable, signal } from '@angular/core';
import { DemoStore } from '../data-access/demo-store';
import { Actor, Role } from '../domain/models';
@Injectable({ providedIn: 'root' })
export class Session {
  private store = inject(DemoStore);
  readonly userId = signal<string | null>(sessionStorage.getItem('thaikana-demo-user'));
  readonly user = computed(() =>
    this.store.state().users.find((u) => u.id === this.userId() && u.active),
  );
  readonly actor = computed<Actor>(() => ({
    userId: this.user()?.id ?? '',
    stationId: this.user()?.role === 'Station' ? this.user()?.id : undefined,
    deviceId: this.store.deviceId,
  }));
  can(...roles: Role[]) {
    return !!this.user() && (this.user()!.role === 'Admin' || roles.includes(this.user()!.role));
  }
  login(id: string) {
    sessionStorage.setItem('thaikana-demo-user', id);
    this.userId.set(id);
  }
  logout() {
    sessionStorage.removeItem('thaikana-demo-user');
    this.userId.set(null);
  }
}
