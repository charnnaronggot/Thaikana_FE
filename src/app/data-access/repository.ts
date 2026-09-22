import { Actor, Command, DemoState } from '../domain/models';
/** Domain port. A future HTTP adapter must implement semantics; no backend dependency in Demo. */
export interface Repository {
  read(): Promise<DemoState>;
  execute<T>(command: Command, actor: Actor): Promise<{ state: DemoState; result: T }>;
  reset(): Promise<DemoState>;
}
