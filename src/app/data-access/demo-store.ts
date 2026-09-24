import { Injectable, signal } from '@angular/core';
import { Actor, DemoState, DomainError, uid } from '../domain/models';
import { createSeed } from '../domain/seed';
import { DemoRepository } from './demo-repository';
@Injectable({ providedIn: 'root' })
export class DemoStore {
  readonly state = signal<DemoState>(createSeed());
  readonly ready = signal(false);
  readonly error = signal('');
  readonly changed = signal(false);
  readonly repository = new DemoRepository();
  readonly channel = new BroadcastChannel('thaikana-demo-events');
  readonly deviceId = uid();
  constructor() {
    void this.refresh();
    this.channel.onmessage = () => this.changed.set(true);
  }
  async refresh() {
    try {
      this.state.set(await this.repository.read());
      this.ready.set(true);
      this.changed.set(false);
      this.error.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async run<T = unknown>(
    type: string,
    data: unknown,
    actor: Actor,
    expectedVersion = this.state().version,
    key = uid(),
  ): Promise<T> {
    if (!this.ready()) throw new DomainError('storage', 'ข้อมูลยังโหลดไม่เสร็จ');
    const result = await this.repository.execute<T>({ type, data, expectedVersion, key }, actor);
    this.state.set(result.state);
    this.channel.postMessage(result.state.version);
    return result.result;
  }
  async reset() {
    this.state.set(await this.repository.reset());
    this.channel.postMessage('reset');
  }
}
