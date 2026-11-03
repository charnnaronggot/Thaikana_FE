import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiClient } from '../../../core/services/api/api-client.service';
import { NativeApi } from '../../modules/native-api.service';
import { DesignDetail, DesignDrawing, DesignInbox, DesignLookups } from '../models/design.models';
@Injectable({ providedIn: 'root' })
export class DesignApi {
  private api = inject(ApiClient);
  private http = inject(HttpClient);
  private native = inject(NativeApi);
  inbox() {
    return this.api.get<DesignInbox>('/design/inbox');
  }
  lookups() {
    return this.api.get<DesignLookups>('/design/lookups');
  }
  detail(id: string) {
    return this.api.get<DesignDetail>('/design/revisions/' + encodeURIComponent(id));
  }
  upload(file: File, revisionId: string) {
    const form = new FormData();
    const source = /\.pdf$/i.test(file.name)
      ? new Blob([file], { type: 'application/pdf' })
      : /\.(dwg|dxf)$/i.test(file.name)
        ? new Blob([file], { type: 'application/octet-stream' })
        : file;
    form.append('file', source, file.name);
    form.append('ownerType', 'PRODUCT_REVISION');
    form.append('ownerId', revisionId);
    return firstValueFrom(
      this.http.post<{ id: string; originalName: string; mimeType: string; sizeBytes: number }>(
        environment.apiUrl + '/files',
        form,
        { withCredentials: true },
      ),
    );
  }
  file(id: string) {
    return firstValueFrom(
      this.http.get(environment.apiUrl + '/files/' + encodeURIComponent(id), {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }
  preview(id: string) { return this.native.preview(id); }
}
