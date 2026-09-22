import { Actor, Command, DemoState, DomainError, ensure, required } from '../domain/models';
import { createSeed } from '../domain/seed';
import { handlers } from '../domain/handlers';
import { Repository } from './repository';
export function applyCommand(
  state: DemoState,
  command: Command,
  actor: Actor,
  now = new Date().toISOString(),
): { state: DemoState; result: unknown } {
  const user = required(state.users.find((u) => u.id === actor.userId));
  ensure(user.active, 'บัญชีถูกระงับ', 'denied');
  if (Object.hasOwn(state.applied, command.key))
    return { state, result: state.applied[command.key] };
  ensure(
    command.expectedVersion === state.version,
    'ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณารีเฟรชแล้วตรวจข้อมูลก่อนลองใหม่',
    'conflict',
  );
  const next = structuredClone(state);
  const handler = handlers[command.type];
  ensure(handler, 'ไม่รองรับคำสั่ง ' + command.type);
  const result = handler(next, command.data, {
    actor,
    now,
    user: required(next.users.find((u) => u.id === user.id)),
  });
  next.version++;
  next.applied[command.key] = result ?? null;
  return { state: next, result };
}
export class DemoRepository implements Repository {
  private db: Promise<IDBDatabase>;
  constructor(name = 'thaikana-demo-v1') {
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('state');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(
          new DomainError('storage', 'เปิดพื้นที่เก็บ Demo ไม่ได้ กรุณาอนุญาต storage ใน browser'),
        );
    });
  }
  private async transaction<T>(
    change: (s: DemoState) => { state: DemoState; result: T },
  ): Promise<{ state: DemoState; result: T }> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const get = store.get('current');
      let output: { state: DemoState; result: T };
      let failure: unknown;
      get.onsuccess = () => {
        try {
          output = change(get.result ?? createSeed());
          store.put(output.state, 'current');
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(output);
      tx.onerror = () =>
        reject(
          failure ?? new DomainError('storage', 'บันทึกไม่สำเร็จ กรุณาตรวจพื้นที่ว่างแล้วลองใหม่'),
        );
      tx.onabort = () =>
        reject(failure ?? new DomainError('storage', 'ธุรกรรมถูกยกเลิก ไม่มีข้อมูลเปลี่ยนแปลง'));
    });
  }
  async read() {
    return (await this.transaction((state) => ({ state, result: null }))).state;
  }
  async execute<T>(command: Command, actor: Actor) {
    return this.transaction(
      (state) => applyCommand(state, command, actor) as { state: DemoState; result: T },
    );
  }
  async reset() {
    return (
      await this.transaction((old) => {
        const state = createSeed();
        state.version = old.version + 1;
        return { state, result: null };
      })
    ).state;
  }
}
