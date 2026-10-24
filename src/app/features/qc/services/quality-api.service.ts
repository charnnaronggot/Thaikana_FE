import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NativeApi } from '../../modules/native-api.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { OfflineTransactionError } from '../../../core/services/api/api-client.service';

export type QualityDetail = components['schemas']['QualityInspectionDetail'];
export type QualitySlot = components['schemas']['QualityPhotoSlotState'];
export type QualityMutation = components['schemas']['QualityMutationResult'];
@Injectable({ providedIn: 'root' })
export class QualityApi {
  private native = inject(NativeApi);
  private http = inject(HttpClient);
  workspace(search = '', status = '', page = 1) {
    return this.native.get<components['schemas']['QualityWorkspace']>('/quality/workspace', {
      search,
      status,
      page,
      pageSize: 20,
    });
  }
  detail(id: string) {
    return this.native.get<QualityDetail>('/quality/inspections/' + id);
  }
  source(id: string, workOrderId: string) {
    return this.native.get<components['schemas']['QualityWorkOrderSource']>(
      '/quality/inspections/' + id + '/work-orders/' + workOrderId,
    );
  }
  settings(search = '') {
    return this.native.get<components['schemas']['QualitySettingsWorkspace']>('/quality/settings', {
      search,
    });
  }
  assignment(id: string) {
    return this.native.get<components['schemas']['QualityItemAssignment']>(
      '/quality/products/' + id + '/group',
    );
  }
  finishedGoods(search = '') {
    return this.native.get<components['schemas']['FinishedGoodsWorkspace']>(
      '/inventory/finished-goods',
      { search },
    );
  }
  file(id: string) {
    return this.native.file(id);
  }
  upload(
    id: string,
    version: number | string,
    side: string,
    slot: number | string,
    file: File,
    caption: string,
    reason: string,
    key: string,
  ) {
    if (navigator.onLine === false)
      return Promise.reject<QualityMutation>(new OfflineTransactionError());
    const type = /\.png$/i.test(file.name)
      ? 'image/png'
      : /\.jpe?g$/i.test(file.name)
        ? 'image/jpeg'
        : /\.webp$/i.test(file.name)
          ? 'image/webp'
          : file.type;
    const form = new FormData();
    form.append('file', new Blob([file], { type }), file.name);
    form.append('expectedVersion', String(version));
    form.append('side', side);
    form.append('slot', String(slot));
    form.append('caption', caption);
    form.append('reason', reason);
    return firstValueFrom(
      this.http.post<QualityMutation>(
        environment.apiUrl + '/quality/inspections/' + id + '/photos/upload',
        form,
        { withCredentials: true, headers: new HttpHeaders({ 'Idempotency-Key': key }) },
      ),
    );
  }
}
