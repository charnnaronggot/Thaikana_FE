import { Component, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
@Component({
  selector: 'app-filter',
  template: `<div class="filter">
    <label class="search-field"
      ><span class="sr-only">ค้นหา</span
      ><input
        aria-label="ค้นหา"
        [placeholder]="placeholder()"
        [value]="query"
        (input)="setQuery($event)" /></label
    ><label
      ><span class="sr-only">สถานะ</span
      ><select aria-label="กรองสถานะ" [value]="status" (change)="setStatus($event)">
        <option value="">ทุกสถานะ</option>
        @for (s of statuses(); track s) {
          <option [value]="s">{{ s }}</option>
        }
      </select></label
    ><button type="button" (click)="clear()">ล้างตัวกรอง</button
    ><span class="muted">{{ count() }} รายการ</span>
  </div>`,
})
export class ListFilter {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  placeholder = input('ค้นหารหัส / ชื่อ');
  statuses = input<string[]>([]);
  count = input(0);
  change = output<{ query: string; status: string }>();
  query = this.route.snapshot.queryParamMap.get('q') ?? '';
  status = this.route.snapshot.queryParamMap.get('status') ?? '';
  ngOnInit() {
    this.change.emit({ query: this.query, status: this.status });
  }
  setQuery(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    this.update();
  }
  setStatus(e: Event) {
    this.status = (e.target as HTMLSelectElement).value;
    this.update();
  }
  clear() {
    this.query = '';
    this.status = '';
    this.update();
  }
  update() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.query || null, status: this.status || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.change.emit({ query: this.query, status: this.status });
  }
}
