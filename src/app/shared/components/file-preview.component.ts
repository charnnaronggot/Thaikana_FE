import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiClient, problemMessage } from '../../core/services/api/api-client.service';
import { Drawer, StateMessage } from './ui';
@Component({
  selector: 'app-file-preview',
  imports: [Drawer, StateMessage],
  template: `
    <app-overlay [title]="title()" [dialog]="dialog()" [size]="size()" (close)="closed.emit()"
      ><app-state [retryable]="true" [loading]="loading()" [error]="error()" (retry)="load()" />
      @if (url()) {
        @if (image()) {
          <img class="document-image" [src]="url()" alt="แบบที่อนุมัติของงานนี้" />
        } @else {
          <iframe title="เอกสาร PDF" [src]="trustedUrl()"></iframe>
        }
      }
      <button footer (click)="closed.emit()">ปิด</button>
      @if (url()) {
        <a footer class="button" [href]="url()" download="thaikana-document">ดาวน์โหลด</a>
      }
    </app-overlay>
  `,
  styles: `
    .document-image {
      display: block;
      max-width: 100%;
      height: auto;
      margin: auto;
    }
    iframe {
      width: 100%;
      min-height: 65dvh;
      border: 0;
    }
  `,
})
export class FilePreview {
  readonly title = input('แบบ / เอกสารแนบ');
  readonly dialog = input(false);
  readonly size = input<'compact' | 'form' | 'wide'>('compact');
  readonly fileId = input.required<string>();
  readonly closed = output();
  private api = inject(ApiClient);
  private sanitizer = inject(DomSanitizer);
  private destroy = inject(DestroyRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly url = signal('');
  readonly trustedUrl = signal<SafeResourceUrl | null>(null);
  readonly image = signal(false);
  constructor() {
    this.destroy.onDestroy(() => this.release());
  }
  ngOnInit() {
    void this.load();
  }
  private release() {
    if (this.url()) URL.revokeObjectURL(this.url());
    this.url.set('');
  }
  async load() {
    this.release();
    this.loading.set(true);
    this.error.set('');
    try {
      const blob = await this.api.file(this.fileId());
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(blob.type))
        throw new Error('ชนิดเอกสารไม่รองรับ');
      const url = URL.createObjectURL(blob);
      this.url.set(url);
      this.image.set(blob.type.startsWith('image/'));
      this.trustedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
