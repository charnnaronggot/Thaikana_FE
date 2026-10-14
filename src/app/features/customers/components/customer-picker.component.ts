import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CustomerApi } from '../customer-api.service';
import { Customer } from '../models/customer.models';
import { StateMessage } from '../../../shared/components/ui';
import { problemMessage } from '../../../core/services/api/api-client.service';
@Component({
  selector: 'app-customer-picker',
  imports: [StateMessage],
  templateUrl: './customer-picker.component.html',
  styleUrl: './customer-picker.component.scss',
})
export class CustomerPicker {
  private static nextId = 0;
  private api = inject(CustomerApi);
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryCustomer: Customer | null = null;
  readonly listId = 'quotation-customers-' + CustomerPicker.nextId++;
  readonly disabled = input(false);
  readonly chosen = output<Customer | null>();
  readonly loading = signal(false);
  readonly selecting = signal(false);
  readonly error = signal('');
  readonly customers = signal<Customer[]>([]);
  readonly selected = signal<Customer | null>(null);
  readonly query = signal('');
  readonly total = signal(0);
  readonly open = signal(false);
  readonly activeIndex = signal(0);
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  readonly changeButton = viewChild<ElementRef<HTMLButtonElement>>('changeButton');
  readonly activeOption = computed(() =>
    this.open() && !this.loading() && !this.error() && this.customers().length
      ? this.listId + '-' + Math.min(this.activeIndex(), this.customers().length - 1)
      : null,
  );
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.generation++;
    });
  }
  ngOnInit() {
    this.load();
  }
  search(value: string) {
    if (this.disabled() || this.selecting()) return;
    this.query.set(value);
    this.open.set(true);
    this.activeIndex.set(0);
    this.retryCustomer = null;
    clearTimeout(this.timer);
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.customers.set([]);
    this.timer = setTimeout(() => void this.fetch(generation, value), 250);
  }
  load() {
    if (this.disabled() || this.selecting()) return;
    clearTimeout(this.timer);
    this.loading.set(true);
    this.error.set('');
    void this.fetch(++this.generation, this.query());
  }
  private async fetch(generation: number, query: string) {
    try {
      const page = await this.api.list(query, 1, true);
      if (generation !== this.generation) return;
      this.customers.set(page.items);
      this.total.set(page.totalCount ?? page.items.length);
      this.activeIndex.set(0);
    } catch (e) {
      if (generation === this.generation) this.error.set(problemMessage(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async choose(customer: Customer) {
    if (this.disabled() || this.selecting() || this.loading()) return;
    clearTimeout(this.timer);
    const generation = ++this.generation;
    this.retryCustomer = customer;
    this.selecting.set(true);
    this.loading.set(true);
    this.error.set('');
    this.chosen.emit(null);
    try {
      const current = await this.api.detail(customer.id);
      if (generation !== this.generation) return;
      if (!current.isActive) throw new Error('ลูกค้าปิดใช้งานแล้ว กรุณาเลือกใหม่');
      this.selected.set(current);
      this.chosen.emit(current);
      this.open.set(false);
      this.retryCustomer = null;
      setTimeout(() => this.changeButton()?.nativeElement.focus());
    } catch (e) {
      if (generation === this.generation) {
        this.error.set(problemMessage(e));
        this.open.set(true);
      }
    } finally {
      if (generation === this.generation) {
        this.loading.set(false);
        this.selecting.set(false);
      }
    }
  }
  change() {
    if (this.disabled() || this.selecting()) return;
    this.selected.set(null);
    this.chosen.emit(null);
    this.query.set('');
    this.retryCustomer = null;
    this.open.set(true);
    this.load();
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }
  retry() {
    if (this.retryCustomer) void this.choose(this.retryCustomer);
    else {
      this.open.set(true);
      this.load();
      setTimeout(() => this.searchInput()?.nativeElement.focus());
    }
  }
  focusOut(event: FocusEvent) {
    if (
      !this.selecting() &&
      !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)
    )
      this.open.set(false);
  }
  keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.open.set(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = this.customers().length;
      if (!this.open()) {
        this.open.set(true);
        this.activeIndex.set(event.key === 'ArrowUp' ? Math.max(0, count - 1) : 0);
      } else
        this.activeIndex.set(
          count ? (this.activeIndex() + (event.key === 'ArrowDown' ? 1 : -1) + count) % count : 0,
        );
      setTimeout(() =>
        document.getElementById(this.activeOption() ?? '')?.scrollIntoView({ block: 'nearest' }),
      );
    } else if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const customer = this.customers()[this.activeIndex()];
      if (customer && !this.loading() && !this.error()) void this.choose(customer);
    }
  }
}
