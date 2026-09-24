import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { priceLine, quoteTotals } from '../src/app/domain/money';
import { applyCommand } from '../src/app/data-access/demo-repository';
describe('Foundation', () => {
  it('AC04 decimal price and profit exclude VAT', () => {
    const line = { quantity: 12, unitPrice: 32000, discount: 5 };
    expect(priceLine(line, 24000)).toMatchObject({ net: 364800, profit: 76800, margin: 21.05 });
    expect(quoteTotals([line], 7)).toEqual({ net: 364800, vat: 25536, total: 390336 });
    expect(priceLine({ quantity: 1, unitPrice: 0, discount: 0 }, 0).margin).toBeNull();
  });
  it('rejects stale or inactive writes atomically', () => {
    const s = createSeed();
    const before = structuredClone(s);
    expect(() =>
      applyCommand(
        s,
        { type: 'missing', data: {}, expectedVersion: 9, key: 'x' },
        { userId: 'admin', deviceId: 'a' },
      ),
    ).toThrow('ข้อมูลเปลี่ยน');
    expect(s).toEqual(before);
    s.users[0].active = false;
    expect(() =>
      applyCommand(
        s,
        { type: 'missing', data: {}, expectedVersion: 0, key: 'x' },
        { userId: 'admin', deviceId: 'a' },
      ),
    ).toThrow('ระงับ');
  });
});
