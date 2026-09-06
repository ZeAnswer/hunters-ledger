import { derivedFromLevels } from '../src/levels';
import { makeCharacter, makeLibrary } from './fixtures';

const lib = makeLibrary();

test('BAB sums per-class progressions', () => {
  const d = derivedFromLevels(makeCharacter(), lib);
  expect(d.bab).toBe(6); // ranger 5 full + MH 1 full
});

test('3/4 and 1/2 progressions floor correctly', () => {
  const c = makeCharacter({ classLevels: [{ classId: 'rogue', level: 5 }, { classId: 'wizard', level: 3 }] });
  const lib2 = makeLibrary();
  lib2.classTables.rogue = { ...lib.classTables.ranger!, id: 'rogue', babProgression: '3/4' };
  lib2.classTables.wizard = { ...lib.classTables.ranger!, id: 'wizard', babProgression: '1/2' };
  expect(derivedFromLevels(c, lib2).bab).toBe(3 + 1);
});

test('base saves: good = 2 + floor(l/2), poor = floor(l/3), summed per class', () => {
  const d = derivedFromLevels(makeCharacter(), lib);
  // ranger 5: fort 4, ref 4, will 1 ; MH 1: fort 2, ref 0, will 0
  expect(d.baseSaves).toEqual({ fort: 6, ref: 4, will: 1 });
});

test('iterative attack count from BAB', () => {
  expect(derivedFromLevels(makeCharacter(), lib).iterativeAttacks).toEqual([6, 1]);
});

test('skill points: x4 at level 1, plus int mod per level; leftover = total - spent', () => {
  const c = makeCharacter({
    levelHistory: [
      { level: 1, classId: 'ranger', hpRolled: 8, skillPointsSpent: { spot: 4 }, featsTaken: [] },
      { level: 2, classId: 'ranger', hpRolled: 5, skillPointsSpent: { spot: 1, survival: 1 }, featsTaken: [] },
    ],
  });
  const d = derivedFromLevels(c, lib);
  // int 16 → +3 ; lvl1: (6+3)*4 = 36 ; lvl2: 9 → 45 total, 6 spent
  expect(d.skillPoints).toEqual({ total: 45, spent: 6, leftover: 39 });
});

test('next XP threshold from table', () => {
  const d = derivedFromLevels(makeCharacter(), lib);
  expect(d.level).toBe(6);
  expect(d.nextLevelXp).toBe(21000);
});

test('level features gathered up to current class level', () => {
  const d = derivedFromLevels(makeCharacter(), lib);
  expect(d.levelFeatures).toEqual(['monster-blow']);
});

test('unknown class table is reported, not thrown', () => {
  const c = makeCharacter({ classLevels: [{ classId: 'bard', level: 2 }] });
  const d = derivedFromLevels(c, lib);
  expect(d.bab).toBe(0);
  expect(d.warnings[0]).toMatch(/bard/);
});

test('extra skill points per level (human) count in totals, x4 at level 1', () => {
  const c = makeCharacter({
    extraSkillPointsPerLevel: 1,
    levelHistory: [
      { level: 1, classId: 'ranger', hpRolled: 8, skillPointsSpent: { spot: 4 }, featsTaken: [] },
      { level: 2, classId: 'ranger', hpRolled: 5, skillPointsSpent: {}, featsTaken: [] },
    ],
  });
  expect(derivedFromLevels(c, lib).skillPoints.total).toBe(40 + 10);
});
