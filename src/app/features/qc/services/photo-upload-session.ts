import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  OfflineTransactionError,
  problemMessage,
} from '../../../core/services/api/api-client.service';
import { QualityApi, QualityMutation } from './quality-api.service';

@Injectable()
export class PhotoUploadSession {
  private api = inject(QualityApi);
  busy = signal(false);
  uncertain = signal(false);
  error = signal('');
  problemCode = signal('');
  private pending?: {
    id: string;
    version: number | string;
    side: string;
    slot: number | string;
    file: File;
    caption: string;
    reason: string;
    key: string;
    done: (result: QualityMutation) => Promise<void>;
    confirmed?: boolean;
    result?: QualityMutation;
  };
  clear() {
    if (!this.busy() && !this.uncertain()) {
      this.error.set('');
      this.problemCode.set('');
      this.pending = undefined;
    }
  }
  async run(
    id: string,
    version: number | string,
    side: string,
    slot: number | string,
    file: File,
    caption: string,
    reason: string,
    done: (result: QualityMutation) => Promise<void>,
  ) {
    if (this.busy() || this.uncertain()) return;
    this.pending = {
      id,
      version,
      side,
      slot,
      file,
      caption,
      reason,
      key: crypto.randomUUID(),
      done,
    };
    await this.retry();
  }
  async retry() {
    const command = this.pending;
    if (!command || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.problemCode.set('');
    try {
      if (!command.confirmed) {
        command.result = await this.api.upload(
          command.id,
          command.version,
          command.side,
          command.slot,
          command.file,
          command.caption,
          command.reason,
          command.key,
        );
        command.confirmed = true;
      }
      await command.done(command.result!);
      this.pending = undefined;
      this.uncertain.set(false);
    } catch (e) {
      const unknown =
        !!command.confirmed ||
        (e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500)) ||
        (e instanceof OfflineTransactionError && this.uncertain());
      this.uncertain.set(unknown);
      if (!unknown) this.pending = undefined;
      if (e instanceof HttpErrorResponse) this.problemCode.set(e.error?.code ?? '');
      this.error.set(
        (command.confirmed ? 'บันทึกรูปแล้ว แต่โหลดผลไม่ได้ · ' : '') + problemMessage(e),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
