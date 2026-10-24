import { Component, effect, inject, input, signal } from '@angular/core';
import { QualityApi } from '../services/quality-api.service';

@Component({
  selector: 'app-private-photo-thumb',
  template: `@if (url()) {
      <img [src]="url()" [alt]="label()" loading="lazy" decoding="async" />
    } @else {
      <span>{{ failed() ? 'เปิดรูปเพื่อดูรายละเอียด' : 'กำลังโหลดภาพ...' }}</span>
    }`,
  styles: `
    :host {
      display: flex;
      width: 100%;
      height: 130px;
      align-items: center;
      justify-content: center;
      background: var(--canvas);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    span {
      font-size: 12px;
      color: var(--muted);
    }
  `,
})
export class PrivatePhotoThumb {
  fileId = input.required<string>();
  label = input('ภาพ QC');
  url = signal('');
  failed = signal(false);
  private api = inject(QualityApi);
  constructor() {
    effect((cleanup) => {
      const id = this.fileId();
      let active = true;
      let resource = '';
      this.url.set('');
      this.failed.set(false);
      void (async () => {
        try {
          const blob = await this.api.file(id);
          if (!active) return;
          const bitmap = await createImageBitmap(blob);
          try {
            if (!active) return;
            const ratio = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
            canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
            const context = canvas.getContext('2d');
            if (!context) throw Error('preview');
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const thumb = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/jpeg', 0.82),
            );
            if (active && thumb) {
              resource = URL.createObjectURL(thumb);
              this.url.set(resource);
            }
          } finally {
            bitmap.close();
          }
        } catch {
          if (active) this.failed.set(true);
        }
      })();
      cleanup(() => {
        active = false;
        if (resource) URL.revokeObjectURL(resource);
      });
    });
  }
}
