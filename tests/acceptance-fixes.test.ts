import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { create, createInjector } from './support/angular';
import { InventoryTools } from '../src/app/features/inventory/components/inventory-tools.component';
import { NativeApi } from '../src/app/features/modules/native-api.service';
import { ApiClient } from '../src/app/core/services/api/api-client.service';
import { MutationSession } from '../src/app/shared/utils/mutation-session';

// Acceptance walkthrough 2026-11-04 (DEV): WO-202611-000002 reserved 0.8 on LOT01 and 16 on LOT02.
// Store picked LOT01 with the request's full 16.8 and the server answered a generic 409.
const options = {
  items: [], locations: [], workOrders: [], originals: [], truncated: false,
  requests: [{ id: 'req-1', requestNo: 'MR-1', woNo: 'WO-1', itemId: 'rm-1', componentId: 'cmp-1', remaining: 16.8, unit: 'KG' }],
  buckets: [
    { id: 'lot-1', itemId: 'rm-1', category: 'UNRESTRICTED', onHand: 0.8, reserved: 0.8, available: 0, version: 1 },
    { id: 'lot-2', itemId: 'rm-1', category: 'UNRESTRICTED', onHand: 20, reserved: 16, available: 4, version: 1 },
  ],
  reservations: [
    { id: 'res-1', componentId: 'cmp-1', bucketId: 'lot-1', outstanding: 0.8 },
    { id: 'res-2', componentId: 'cmp-1', bucketId: 'lot-2', outstanding: 16 },
  ],
};

async function issueForm() {
  const post = vi.fn().mockResolvedValue({ documentId: 'doc-1' });
  const tools = create(InventoryTools, createInjector([MutationSession, { provide: NativeApi, useValue: { get: vi.fn().mockResolvedValue(options) } }, { provide: ApiClient, useValue: { post } }]));
  await tools.begin('issue');
  tools.model.requestId = 'req-1'; tools.chooseRequest();
  return { tools, post };
}

describe('Inventory issue: one posting per lot reservation', () => {
  it('caps the quantity to the chosen lot reservation and posts it', async () => {
    const { tools, post } = await issueForm();
    expect(tools.model.quantity).toBe(16.8);
    tools.model.bucketId = 'lot-1'; tools.chooseBucket();
    expect(tools.model.reservationId).toBe('res-1');
    expect(tools.issueLimit()).toBe(0.8);
    expect(tools.model.quantity).toBe(0.8);
    await tools.save();
    expect(tools.error()).toBe('');
    expect(post).toHaveBeenCalledWith('/inventory/issue', { requestItemId: 'req-1', bucketId: 'lot-1', reservationId: 'res-1', quantity: 0.8, expectedVersion: 1 }, expect.any(String));
  });

  it('refuses more than the lot reservation in Thai without calling the API', async () => {
    const { tools, post } = await issueForm();
    tools.model.bucketId = 'lot-1'; tools.chooseBucket();
    tools.model.quantity = 16.8;
    await tools.save();
    expect(tools.error()).toContain('สูงสุด 0.8');
    expect(post).not.toHaveBeenCalled();
  });

  it('never exceeds the request remaining even when the reservation is larger', async () => {
    const { tools } = await issueForm();
    tools.model.bucketId = 'lot-2'; tools.chooseBucket();
    expect(tools.issueLimit()).toBe(16);
    tools.model.quantity = 5; tools.chooseReservation();
    expect(tools.model.quantity).toBe(5);
  });

  it('wires the reservation change and shows the per-lot limit', () => {
    const template = readFileSync('src/app/features/inventory/components/inventory-tools.component.html', 'utf8');
    expect(template).toContain('(ngModelChange)="chooseReservation()"');
    expect(template).toContain('เบิกได้สูงสุด {{ issueLimit()');
  });
});

describe('Planning tools load error can be retried', () => {
  it('offers the retry button on the planning tools error banner', () => {
    const template = readFileSync('src/app/features/planning/components/planning-tools.component.html', 'utf8');
    expect(template.split('\n')[0]).toBe('<app-state [loading]="busy()" [error]="error()" [retryable]="true" (retry)="load()" />');
  });
});
