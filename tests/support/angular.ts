import '@angular/compiler';
import { parseTemplate } from '@angular/compiler';
import { DOCUMENT, Injector, InputSignal, Provider, runInInjectionContext, Type } from '@angular/core';
import { SIGNAL } from '@angular/core/primitives/signals';
import { ModalScrollLock } from '../../src/app/shared/utils/modal-scroll-lock';

// Vitest runs in node without a DOM, so components are created as plain classes in an injection
// context and their templates are checked with the Angular template parser instead of rendering.

export function fakeDocument(clipboard?: { writeText(text: string): Promise<void> }) {
  const style = () => ({ top: '', left: '', scrollBehavior: '' });
  const classes = new Set<string>();
  return {
    classes,
    defaultView: { scrollX: 0, scrollY: 120, scrollTo: () => undefined, navigator: { clipboard } },
    documentElement: { style: style(), classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } },
    body: { style: style() },
  };
}

export function createInjector(providers: Provider[] = [], document: unknown = fakeDocument()) {
  return Injector.create({ providers: [ModalScrollLock, { provide: DOCUMENT, useValue: document }, ...providers] });
}

export function create<T>(type: Type<T>, injector = createInjector()): T {
  return runInInjectionContext(injector, () => new type());
}

/** Same path Angular uses when a parent binds `[input]="value"`. */
export function setInput<T>(input: InputSignal<T>, value: T) {
  const node = (input as unknown as Record<symbol, { applyValueToInputSignal(n: unknown, v: T): void }>)[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

export interface TemplateElement {
  name: string;
  attrs: Record<string, string>;
  inputs: string[];
  outputs: string[];
  text: string;
}

/** Flattens every element of an Angular template (including @if/@for/@empty branches). */
export function templateElements(template: string): TemplateElement[] {
  const { nodes, errors } = parseTemplate(template, 'template.html', {});
  if (errors?.length) throw new Error(errors.map((e) => e.msg).join('\n'));
  const found: TemplateElement[] = [];
  const text = (node: any): string =>
    typeof node?.value === 'string' ? node.value : node?.value?.source ?? (node?.children ?? []).map(text).join('');
  const walk = (node: any): void => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node.name === 'string' && Array.isArray(node.attributes) && Array.isArray(node.inputs))
      found.push({
        name: node.name,
        attrs: Object.fromEntries(node.attributes.map((a: any) => [a.name, a.value])),
        inputs: node.inputs.map((i: any) => i.name),
        outputs: node.outputs.map((o: any) => o.name),
        text: text(node).replace(/\s+/g, ' ').trim(),
      });
    walk(node.children);
    walk(node.branches);
    walk(node.empty);
    walk(node.cases);
  };
  walk(nodes);
  return found;
}

/** Inline template of a component declared with `template:` (kept on the class by the JIT decorator). */
export function inlineTemplate(type: Type<unknown>): string {
  const annotations = (type as unknown as { __annotations__?: { template?: string }[] }).__annotations__ ?? [];
  const template = annotations.find((a) => typeof a.template === 'string')?.template;
  if (!template) throw new Error(type.name + ' has no inline template');
  return template;
}
