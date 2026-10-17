import { Component, input } from '@angular/core';
export interface WorkflowStep {
  label: string;
  complete: boolean;
  current: boolean;
}
@Component({
  selector: 'app-workflow-guide',
  template: `<section class="guide" aria-label="ขั้นตอนและงานถัดไป">
    <ol>
      @for (step of steps(); track step.label; let i = $index) {
        <li
          [class.complete]="step.complete"
          [class.current]="step.current"
          [attr.aria-current]="step.current ? 'step' : null"
        >
          <span aria-hidden="true">{{ step.complete ? '✓' : i + 1 }}</span
          >{{ step.label }}
        </li>
      }
    </ol>
    <div class="next">
      <div>
        <strong>{{ title() }}</strong>
        <p>{{ description() }}</p>
      </div>
      <span class="owner">ผู้ดำเนินการ: {{ owner() }}</span>
    </div>
    <ng-content />
  </section>`,
  styles: `
    :host {
      display: block;
      margin: 12px 0 20px;
    }
    .guide {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      background: #f7f9fc;
    }
    ol {
      list-style: none;
      display: flex;
      gap: 8px;
      margin: 0 0 16px;
      padding: 0;
      overflow: auto;
    }
    li {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: max-content;
      font-size: 12px;
      color: var(--muted);
    }
    li span {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e7ecf3;
      flex-shrink: 0;
    }
    .complete {
      color: #177245;
    }
    .complete span {
      background: #ddf2e7;
    }
    .current {
      color: var(--primary);
      font-weight: 600;
    }
    .current span {
      background: var(--primary);
      color: white;
    }
    .next {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }
    .next strong {
      font-size: 14px;
    }
    .next p {
      font-size: 12px;
      color: var(--muted);
      margin: 6px 0 0;
      line-height: 1.7;
    }
    .owner {
      font-size: 11px;
      white-space: nowrap;
      color: var(--primary);
    }
    @media (max-width: 700px) {
      .guide {
        padding: 12px;
      }
      .next {
        flex-direction: column;
      }
      li {
        flex: 0;
        min-width: 24px;
        font-size: 0;
        gap: 0;
      }
      li span {
        font-size: 11px;
      }
      .current {
        flex: 1;
        min-width: 0;
        font-size: 11px;
        gap: 6px;
      }
    }
  `,
})
export class WorkflowGuide {
  readonly steps = input<WorkflowStep[]>([]);
  readonly title = input('');
  readonly description = input('');
  readonly owner = input('');
}
