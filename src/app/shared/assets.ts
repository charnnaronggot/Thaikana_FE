import { Component, computed, input, output } from '@angular/core';
import { Feature } from './ui';
import { uid } from '../domain/models';
@Component({
  selector: 'app-assets',
  template: `<div class="asset-list">
      @for (a of assets(); track a.id) {
        <div class="asset-item">
          @if (a.mime.startsWith('image/')) {
            <img [src]="url(a.id)" [alt]="a.name" />
          }
          <div>
            <strong>{{ a.name }}</strong
            ><small>{{ (a.blob.size / 1024).toFixed(1) }} KB</small
            ><a [href]="url(a.id)" [download]="a.name">ดาวน์โหลด</a>
            <a [href]="url(a.id)" target="_blank" rel="noopener">เปิดไฟล์</a>
          </div>
        </div>
      } @empty {
        <p class="muted">ยังไม่มีไฟล์แนบ</p>
      }
    </div>
    @if (!readonly()) {
      <label class="upload-field"
        >แนบ Drawing / PDF / รูปภาพ<input
          type="file"
          multiple
          [disabled]="uploading"
          (change)="upload($event)"
      /></label>
    }
    @if (error()) {
      <p class="field-error" role="alert">{{ error() }}</p>
    }`,
  styles: `
    .asset-item {
      display: flex;
      gap: 14px;
      border: 1px solid #dee2e7;
      background: white;
      padding: 12px;
      margin-bottom: 10px;
    }
    .asset-item img {
      width: 100px;
      height: 90px;
      object-fit: contain;
    }
    .asset-item small {
      display: block;
      color: #8490a1;
    }
    .asset-item a {
      font-size: 11px;
      margin-right: 10px;
    }
    .upload-field {
      border: 1px dashed #c8d1df;
      padding: 14px;
      background: #f8fafc;
    }
    .upload-field input {
      font-size: 11px;
    }
  `,
})
export class Assets extends Feature {
  ids = input<string[]>([]);
  readonly = input(false);
  changed = output<string[]>();
  uploading = false;
  assets = computed(() => this.store.state().assets.filter((a) => this.ids().includes(a.id)));
  private urls = new Map<string, string>();
  url(id: string) {
    if (!this.urls.has(id)) {
      const a = this.store.state().assets.find((a) => a.id === id);
      if (a) this.urls.set(id, URL.createObjectURL(a.blob));
    }
    return this.urls.get(id) ?? '';
  }
  ngOnDestroy() {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
  }
  async upload(e: Event) {
    this.uploading = true;
    const ids = [...this.ids()];
    try {
      for (const file of Array.from((e.target as HTMLInputElement).files ?? [])) {
        if (!/\.(pdf|png|jpe?g|webp|svg|dwg|dxf)$/i.test(file.name))
          throw Error('รองรับ PDF, รูปภาพ, DWG และ DXF เท่านั้น');
        const id = await this.run<string>('asset.add', {
          id: uid(),
          name: file.name,
          mime: file.type || 'application/octet-stream',
          blob: file,
        });
        if (!id) break;
        ids.push(id);
        this.changed.emit([...ids]);
      }
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.uploading = false;
      (e.target as HTMLInputElement).value = '';
    }
  }
}
