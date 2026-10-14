import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import type { ProductRevision } from '../models/sales-api.models';

@Component({
  selector: 'app-quotation-product-picker',
  templateUrl: './quotation-product-picker.component.html',
  styleUrl: './quotation-product-picker.component.scss',
})
export class QuotationProductPicker {
  private static nextId = 0;
  readonly listId = 'quotation-products-' + QuotationProductPicker.nextId++;
  readonly products = input.required<readonly ProductRevision[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input(false);
  readonly selectedProduct = output<string | null>();
  readonly query = signal('');
  readonly open = signal(false);
  readonly activeIndex = signal(0);
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  readonly changeButton = viewChild<ElementRef<HTMLButtonElement>>('changeButton');
  readonly selected = computed(() => this.products().find((p) => p.id === this.selectedId()));
  readonly matches = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.products()
      .filter((p) =>
        ((p.productCode ?? '') + ' ' + (p.productName ?? '')).toLocaleLowerCase().includes(query),
      )
      .sort(
        (a, b) =>
          (a.productCode ?? '').localeCompare(b.productCode ?? '', 'en', { numeric: true }) ||
          (b.revision ?? 0) - (a.revision ?? 0),
      );
  });
  readonly activeOption = computed(() =>
    this.open() && this.matches().length
      ? this.listId + '-' + Math.min(this.activeIndex(), this.matches().length - 1)
      : null,
  );

  search(value: string) {
    this.query.set(value);
    this.activeIndex.set(0);
    this.open.set(true);
  }
  choose(product: ProductRevision) {
    if (this.disabled() || !product.id) return;
    this.open.set(false);
    this.query.set('');
    this.selectedProduct.emit(product.id);
    setTimeout(() => this.changeButton()?.nativeElement.focus());
  }
  change() {
    if (this.disabled()) return;
    this.query.set('');
    this.activeIndex.set(0);
    this.open.set(true);
    this.selectedProduct.emit(null);
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }
  focusOut(event: FocusEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
      this.open.set(false);
  }
  keydown(event: KeyboardEvent) {
    const count = this.matches().length;
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.open.set(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
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
      const product = this.matches()[this.activeIndex()];
      if (product) this.choose(product);
    }
  }
}
