import { applyHp } from '../src/hp';
import { makeCharacter } from './fixtures';

const c = makeCharacter({ hp: { max: 44, current: 30, temp: 5, nonlethal: 0 } });

test('damage consumes temp hp first', () => {
  expect(applyHp(c, { damage: 8 }).hp).toEqual({ max: 44, current: 27, temp: 0, nonlethal: 0 });
  expect(applyHp(c, { damage: 3 }).hp).toEqual({ max: 44, current: 30, temp: 2, nonlethal: 0 });
});

test('heal caps at max and does not touch temp', () => {
  expect(applyHp(c, { heal: 20 }).hp.current).toBe(44);
  expect(applyHp(c, { heal: 20 }).hp.temp).toBe(5);
});

test('temp hp replaces rather than stacks (takes higher)', () => {
  expect(applyHp(c, { temp: 3 }).hp.temp).toBe(5);
  expect(applyHp(c, { temp: 9 }).hp.temp).toBe(9);
});

test('nonlethal accumulates and heals separately', () => {
  const n = applyHp(c, { nonlethal: 6 });
  expect(n.hp.nonlethal).toBe(6);
  expect(applyHp(n, { healNonlethal: 10 }).hp.nonlethal).toBe(0);
});

test('setting max adjusts current by the same delta', () => {
  expect(applyHp(c, { setMax: 50 }).hp).toMatchObject({ max: 50, current: 36 });
});

test('current can go negative (dying) but not below -10 - con', () => {
  expect(applyHp(c, { damage: 40 }).hp.current).toBe(-5);
});
