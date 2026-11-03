import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { AGILE_DRAG_NOTICE, AGILE_LANES, agileColumns, blockAgileDrag } from '../src/app/features/production/models/agile-board';
import { productionProblemMessages } from '../src/app/core/services/api/production-problem-messages';

const card = (operationId: string, lane: string) => ({ lane, work: { operationId } });

describe('F10 Agile production board', () => {
  it('groups server cards in server lane order without dropping or duplicating any card', () => {
    const cards = [card('a', 'READY'), card('b', 'BLOCKED'), card('c', 'IN_PROGRESS'), card('d', 'READY'), card('e', 'DONE')];
    const columns = agileColumns(cards, AGILE_LANES);
    expect(columns.map((c) => c.id)).toEqual(['BLOCKED', 'READY', 'IN_PROGRESS', 'PAUSED', 'DONE']);
    expect(columns.map((c) => c.items.length)).toEqual([1, 2, 1, 0, 1]);
    // Board count parity: every card appears exactly once.
    expect(columns.flatMap((c) => c.items.map((x) => x.work.operationId)).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(columns[1].name).toBe('พร้อมเริ่ม');
  });
  it('keeps an unknown future lane visible instead of hiding its cards', () => {
    const columns = agileColumns([card('a', 'READY'), card('z', 'ON_HOLD')], AGILE_LANES);
    expect(columns.at(-1)).toMatchObject({ id: 'ON_HOLD', name: 'ON_HOLD' });
    expect(columns.reduce((n, c) => n + c.items.length, 0)).toBe(2);
  });
  it('treats drag as a no-op with an explanation (no stage change)', () => {
    const event = { preventDefault: vi.fn(), dataTransfer: { dropEffect: 'move' } as unknown as DataTransfer };
    expect(blockAgileDrag(event)).toBe(AGILE_DRAG_NOTICE);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.dataTransfer.dropEffect).toBe('none');
  });
  it('has no draggable card, drag library or board mutation call in the Station workspace', () => {
    const template = readFileSync('src/app/features/production/pages/station-workspace.component.html', 'utf8');
    const component = readFileSync('src/app/features/production/pages/station-workspace.component.ts', 'utf8');
    expect(template).not.toMatch(/draggable="true"|cdkDrag|cdkDropList/);
    expect(template).toContain('draggable="false"');
    // A view switch during a load must wait (disabled) instead of being silently dropped.
    for (const view of ['board', 'agile', 'list']) expect(template).toContain(`[disabled]="blocked() || !!action()" (click)="setView('${view}')"`);
    expect(component).not.toMatch(/post[^\n]*agile-board/i);
    expect(component).toContain("this.native.get<Agile>('/station/agile-board'");
  });
  it('explains Agile/MTS rule codes in Thai', () => {
    for (const code of ['station_required', 'station_mismatch', 'invalid_dates', 'invalid_quantity_precision', 'release_not_ready', 'invalid_search'])
      expect(productionProblemMessages[code], code).toMatch(/[฀-๿]/);
  });
});
