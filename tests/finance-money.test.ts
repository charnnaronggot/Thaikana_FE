import { expect, it } from 'vitest';
import {
  moneySum,
  moneyRemaining,
  validMoney,
} from '../src/app/features/finance/models/finance-money';
it('allocating 0.10 plus 0.20 never creates a false overpayment or remaining penny', () => {
  expect(moneySum([0.1, 0.2])).toBe(0.3);
  expect(moneyRemaining(0.3, moneySum([0.1, 0.2]))).toBe(0);
  expect(moneyRemaining(100.01, moneySum([33.33, 33.33]))).toBe(33.35);
});
it('actual money rejects unknown, fractional-cent, empty and nonpositive amounts', () => {
  for (const amount of [NaN, Infinity, 0, -1, 0.001]) expect(validMoney(amount)).toBe(false);
  for (const amount of [0.01, 0.1, 100.01]) expect(validMoney(amount)).toBe(true);
});
