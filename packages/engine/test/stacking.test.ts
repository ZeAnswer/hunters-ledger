import { stackBonuses, type BonusEntry } from '../src/stacking';

const b = (value: number, bonusType: BonusEntry['bonusType'], source = 's'): BonusEntry => ({ value, bonusType, source, label: source });

test('untyped bonuses all stack', () => {
  const r = stackBonuses([b(2, 'untyped', 'a'), b(3, 'untyped', 'b')]);
  expect(r.total).toBe(5);
  expect(r.entries.every((e) => e.applied)).toBe(true);
});

test('same typed bonus takes the highest only', () => {
  const r = stackBonuses([b(1, 'enhancement', 'ring'), b(2, 'enhancement', 'bracers')]);
  expect(r.total).toBe(2);
  const ring = r.entries.find((e) => e.source === 'ring')!;
  expect(ring.applied).toBe(false);
  expect(ring.reason).toMatch(/enhancement/);
});

test('dodge and circumstance stack with themselves', () => {
  expect(stackBonuses([b(1, 'dodge'), b(1, 'dodge')]).total).toBe(2);
  expect(stackBonuses([b(2, 'circumstance'), b(2, 'circumstance')]).total).toBe(4);
});

test('penalties always stack, even typed', () => {
  const r = stackBonuses([b(-2, 'enhancement'), b(-1, 'enhancement'), b(3, 'enhancement')]);
  expect(r.total).toBe(0);
});

test('different types stack', () => {
  expect(stackBonuses([b(1, 'enhancement'), b(2, 'insight'), b(1, 'morale')]).total).toBe(4);
});
