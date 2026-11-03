import { DOCUMENT, Injectable, inject } from '@angular/core';

/** Keep the background fixed until the last stacked dialog/drawer is closed. */
@Injectable({ providedIn: 'root' })
export class ModalScrollLock {
  private readonly document = inject(DOCUMENT);
  private count = 0;
  private previous = { top: '', left: '', x: 0, y: 0 };
  acquire() {
    if (++this.count !== 1) return;
    const view = this.document.defaultView, root = this.document.documentElement;
    this.previous = { top: root.style.top, left: root.style.left, x: view?.scrollX ?? 0, y: view?.scrollY ?? 0 };
    root.style.top = -this.previous.y + 'px'; root.style.left = -this.previous.x + 'px';
    root.classList.add('thaikana-modal-open');
  }
  release() {
    if (this.count === 0 || --this.count !== 0) return;
    const root = this.document.documentElement, body = this.document.body;
    root.classList.remove('thaikana-modal-open');
    root.style.top = this.previous.top; root.style.left = this.previous.left;
    const htmlBehavior = root.style.scrollBehavior, bodyBehavior = body.style.scrollBehavior;
    root.style.scrollBehavior = body.style.scrollBehavior = 'auto';
    this.document.defaultView?.scrollTo(this.previous.x, this.previous.y);
    root.style.scrollBehavior = htmlBehavior; body.style.scrollBehavior = bodyBehavior;
  }
}
