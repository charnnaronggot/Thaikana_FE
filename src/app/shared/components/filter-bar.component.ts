import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-filter-bar',
  imports: [FormsModule],
  template: `<div class="filter">
    <label class="search-field"
      >ค้นหา<span class="filter-search"
        ><img src="/icons/83bd0.svg" alt="" /><input
          type="search"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          (keyup.enter)="applied.emit()"
          [placeholder]="placeholder()" /></span
    ></label>
    @if (statuses().length) {
      <label
        >สถานะ<select [ngModel]="status()" (ngModelChange)="status.set($event); applied.emit()">
          <option value="">ทั้งหมด</option>
          @for (value of statuses(); track value) {
            <option>{{ value }}</option>
          }
        </select></label
      >
    }
    <button type="button" (click)="applied.emit()">ค้นหา</button><ng-content />
  </div>`,
  styles: `
    .filter > label {
      display: block;
    }
    .filter {
      align-items: flex-end;
    }
    .filter-search {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0 12px;
      min-height: 40px;
    }
    .filter-search img {
      flex: none;
    }
    .filter-search input {
      margin-top: 0;
      padding: 0;
      min-width: 0;
      border: 0;
      background: transparent;
      outline-offset: 4px;
      flex: 1;
    }
    @media (max-width: 700px) {
      .filter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
      }
      .search-field {
        grid-column: 1 / -1;
      }
      .filter:not(:has(select)) .search-field {
        grid-column: auto;
      }
      .filter-search {
        min-height: 48px;
      }
    }
  `,
})
export class FilterBar {
  readonly query = model('');
  readonly status = model('');
  readonly statuses = input<string[]>([]);
  readonly placeholder = input('เลขที่ / ลูกค้า / สินค้า');
  readonly applied = output();
}
