import { derivedFromLevels, levelSlots, maxRanks } from '../src/levels';
import { resolveStat } from '../src/resolve';
import { applyHp } from '../src/hp';
import { makeCharacter, makeLibrary, makeCtx } from './fixtures';

const lib = makeLibrary();
const history = [
  { level: 1, classId: 'ranger', hpRolled: 8, skillPointsSpent: {}, featsTaken: ['point-blank-shot', 'weapon-focus'], featuresGained: ['track'] },
  { level: 2, classId: 'ranger', hpRolled: 8, skillPointsSpent: {}, featsTaken: [] },
  { level: 3, classId: 'ranger', hpRolled: 8, skillPointsSpent: {}, featsTaken: [] },
  { level: 4, classId: 'ranger', hpRolled: 8, skillPointsSpent: {}, featsTaken: [], abilityIncrease: 'dex' as const },
  { level: 5, classId: 'ranger', hpRolled: 6, skillPointsSpent: {}, featsTaken: [] },
  { level: 6, classId: 'monster-hunter', hpRolled: 6, skillPointsSpent: {}, featsTaken: [] },
];

test('max HP from the ledger = rolled dice + Con mod per level (PHB: min 1 per level)', () => {
  const c = makeCharacter({ levelHistory: history, hp: { max: 1, current: 1, temp: 0, nonlethal: 0 } });
  const d = derivedFromLevels(c, lib);
  expect(d.hpFromLevels).toBe(44 + 6);
  const r = resolveStat(makeCtx({ character: c }), 'hp.max');
  expect(r.total).toBe(50);
  expect(r.entries.map((e) => e.label)).toEqual(['Hit dice rolled', 'CON mod × 6 levels']);
});

test('negative Con still gives at least 1 hp per level', () => {
  const c = makeCharacter({ abilityScores: { str: 10, dex: 10, con: 6, int: 10, wis: 10, cha: 10 }, levelHistory: history.map((h) => ({ ...h, hpRolled: 1 })) });
  expect(derivedFromLevels(c, lib).hpFromLevels).toBe(6);
});

test('without a ledger, hp.max falls back to the stored value plus bonuses', () => {
  const c = makeCharacter({ levelHistory: [] });
  expect(resolveStat(makeCtx({ character: c }), 'hp.max').total).toBe(44);
});

test('applyHp caps healing at the derived max', () => {
  const c = makeCharacter({ levelHistory: history, hp: { max: 44, current: 40, temp: 0, nonlethal: 0 } });
  expect(applyHp(c, { heal: 20 }, 50).hp.current).toBe(50);
});

test('level slots: feats at 1,3,6,9…, human bonus feat at 1, ability increase every 4th level', () => {
  expect(levelSlots(1, { humanBonusFeat: true })).toEqual({ feats: 2, abilityIncrease: false });
  expect(levelSlots(2, { humanBonusFeat: true })).toEqual({ feats: 0, abilityIncrease: false });
  expect(levelSlots(3, { humanBonusFeat: true })).toEqual({ feats: 1, abilityIncrease: false });
  expect(levelSlots(4, { humanBonusFeat: true })).toEqual({ feats: 0, abilityIncrease: true });
  expect(levelSlots(6, { humanBonusFeat: false })).toEqual({ feats: 1, abilityIncrease: false });
  expect(levelSlots(8, { humanBonusFeat: false })).toEqual({ feats: 0, abilityIncrease: true });
});

test('derived audit: ability increases taken, feat slots vs general feats recorded, missing slots warned', () => {
  const c = makeCharacter({ levelHistory: history, extraFeatAtFirstLevel: true });
  const d = derivedFromLevels(c, lib);
  expect(d.abilityIncreases).toEqual({ dex: 1 });
  expect(d.featSlots).toEqual({ expected: 4, recorded: 2 }); // 'track' is a class bonus feat, not a general slot
  expect(d.warnings).toContain('Level 3: a general feat slot has no feat recorded.');
});

test('max ranks: level + 3 for class skills, half for cross-class', () => {
  expect(maxRanks(6, true)).toBe(9);
  expect(maxRanks(6, false)).toBe(4.5);
});
