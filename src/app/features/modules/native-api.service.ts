import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiRecord, Page } from '../../core/models/api.models';
@Injectable({ providedIn: 'root' })
export class NativeApi {
  private http = inject(HttpClient);
  get<T>(path: string, query: Record<string, string | number> = {}) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) params = params.set(k, v);
    return firstValueFrom(
      this.http.get<T>(environment.apiUrl + path, { params, withCredentials: true }),
    );
  }
  records(kind: string, page = 1, search = '') {
    return this.get<Page<ApiRecord>>('/records/' + kind, { page, pageSize: 25, search });
  }
  detail(kind: string, id: string) {
    return this.get<Record<string, unknown>>('/records/' + kind + '/' + encodeURIComponent(id));
  }
  master(kind: string) {
    return this.get<Page<ApiRecord>>('/master/' + kind, { pageSize: 100 });
  }
  file(id: string) {
    return firstValueFrom(
      this.http.get(environment.apiUrl + '/files/' + encodeURIComponent(id), {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }
  async preview(id: string): Promise<Blob> {
    try {
      return await firstValueFrom(this.http.get(environment.apiUrl + '/files/' + encodeURIComponent(id) + '/preview', {
        responseType: 'blob', withCredentials: true,
      }));
    } catch (error) {
      // Only old images without a derived preview use their original. Never
      // hide scope/session/integrity or transport failures with a second path.
      if (error instanceof HttpErrorResponse && error.status === 404) {
        let problem = error.error;
        if (problem instanceof Blob) { try { problem = JSON.parse(await problem.text()); } catch { problem = null; } }
        if (problem?.code === 'preview_unavailable') return this.file(id);
      }
      throw error;
    }
  }
}
