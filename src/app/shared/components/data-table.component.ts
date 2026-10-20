import { Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiRecord } from '../../core/models/api.models';
import { StatusBadge } from './ui';
export interface DataColumn {
  key: string;
  label: string;
  money?: boolean;
  emptyText?: string;
}
@Component({
  selector: 'app-data-table',
  imports: [DatePipe, DecimalPipe, StatusBadge],
  template: `
    <div class="table-wrap" tabindex="0" role="region" aria-label="ตารางรายการ">
      <table class="responsive-table" role="table" [attr.aria-busy]="loading()">
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th [class.number]="numeric(column)" scope="col">{{ column.label }}</th>
            }
            <th scope="col"><span class="visually-hidden">รายละเอียด</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr>
              @for (column of columns(); track column.key) {
                <td [attr.data-label]="column.label" [class.number]="numeric(column)">
                  <span class="cell-value">
                    @if (column.key === 'status') {
                      <app-badge [value]="text(row[column.key])" />
                    } @else if (column.key === 'workflowLabel') {
                      <span class="progress-badge" [attr.data-stage]="row['workflowStage']">{{ text(row[column.key]) }}</span>
                    } @else if (column.key === 'isActive') {
                      <span class="account-state" [class.inactive]="!row[column.key]">{{
                        row[column.key] ? 'เปิดใช้งาน' : 'ระงับใช้งาน'
                      }}</span>
                    } @else if (numeric(column)) {
                      @if (row[column.key] === null || row[column.key] === undefined) {
                        {{ column.emptyText ?? '—' }}
                      } @else {
                        {{ number(row[column.key]) | number: (column.money ? '1.2-2' : '1.0-3') }}
                      }
                    } @else if (column.key.endsWith('At') || column.key.endsWith('Date')) {
                      {{ (dateValue(row[column.key]) | date: 'dd MMM yyyy') ?? '—' }}
                    } @else {
                      {{ text(row[column.key]) }}
                    }
                  </span>
                </td>
              }
              <td class="row-actions">
                <button
                  type="button"
                  class="row-action"
                  [disabled]="loading()"
                  (click)="selected.emit(row)"
                >
                  ดูรายละเอียด
                </button>
              </td>
            </tr>
          } @empty {
            @if (!loading()) {
              <tr class="empty-row">
                <td [attr.colspan]="columns().length + 1">
                  <div class="empty">
                    <strong>ไม่พบรายการ</strong>
                    <p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 12px;
      text-align: left;
      font-size: 14px;
      line-height: 22px;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    th {
      height: 46px;
      font-weight: 600;
      background: var(--canvas);
      white-space: nowrap;
      overflow-wrap: normal;
    }
    td {
      height: 56px;
      border-bottom: 1px solid var(--border);
    }
    .number {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .row-action {
      border: 0;
      background: transparent;
      padding: 8px;
      color: var(--primary);
      white-space: nowrap;
    }
    .account-state {
      color: var(--green);
    }
    .progress-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 20px;
      white-space: nowrap;
      color: #475569;
      background: #f1f5f9;
    }
    .progress-badge[data-stage='NeedsDesign'], .progress-badge[data-stage='WaitingDesign'] {
      color: #92400e; background: #fef3c7;
    }
    .progress-badge[data-stage='ReadyToPrice'], .progress-badge[data-stage='ReadyToIssue'] {
      color: #1e40af; background: #dbeafe;
    }
    .progress-badge[data-stage='ReadyToSend'] { color: #5b21b6; background: #ede9fe; }
    .progress-badge[data-stage='AwaitingCustomer'] { color: #9a3412; background: #ffedd5; }
    .progress-badge[data-stage='Accepted'] { color: #065f46; background: #d1fae5; }
    .account-state.inactive {
      color: var(--muted);
    }
    .empty strong {
      display: block;
      color: var(--ink);
      font-size: 16px;
    }
    .empty p {
      margin: 8px 0 0;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class DataTable {
  readonly columns = input<DataColumn[]>([]);
  readonly rows = input<ApiRecord[]>([]);
  readonly loading = input(false);
  readonly selected = output<ApiRecord>();
  text(value: unknown): string {
    return value == null
      ? '—'
      : Array.isArray(value)
        ? value.join(' · ')
        : typeof value === 'object'
          ? ''
          : String(value);
  }
  dateValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(String(value));
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }
  number(value: unknown) {
    return Number(value) || 0;
  }
  numeric(column: DataColumn) {
    return !!column.money || /quantity|qty$|count$|minutes$/i.test(column.key);
  }
}
