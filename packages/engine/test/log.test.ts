import { countLogEvents, isFirstAttackThisRound } from '../src/log';
import { makeBattle, ev } from './fixtures';

const battle = makeBattle({
  round: 3,
  log: [
    ev({ kind: 'attack', round: 2, targetId: 'g1', result: 'miss' }),
    ev({ kind: 'attack', round: 3, targetId: 'g1', result: 'miss' }),
    ev({ kind: 'attack', round: 3, targetId: 'g1', result: 'hit' }),
    ev({ kind: 'attack', round: 3, targetId: 'g2', result: 'crit' }),
    ev({ kind: 'use', round: 3, abilityId: 'monster-blow', targetId: 'g1' }),
  ],
});

test('miss this round against a target', () => {
  expect(countLogEvents(battle, { event: 'miss', targetId: 'g1', scope: 'thisRound' })).toBe(1);
});

test('miss last round', () => {
  expect(countLogEvents(battle, { event: 'miss', targetId: 'g1', scope: 'lastRound' })).toBe(1);
  expect(countLogEvents(battle, { event: 'miss', targetId: 'g2', scope: 'lastRound' })).toBe(0);
});

test('hit counts crits too, crit counts only crits', () => {
  expect(countLogEvents(battle, { event: 'hit', scope: 'encounter' })).toBe(2);
  expect(countLogEvents(battle, { event: 'crit', scope: 'encounter' })).toBe(1);
});

test('use events filtered by ability', () => {
  expect(countLogEvents(battle, { event: 'use', abilityId: 'monster-blow', scope: 'encounter' })).toBe(1);
  expect(countLogEvents(battle, { event: 'use', abilityId: 'other', scope: 'encounter' })).toBe(0);
});

test('first attack this round', () => {
  expect(isFirstAttackThisRound(battle)).toBe(false);
  expect(isFirstAttackThisRound(makeBattle({ round: 1 }))).toBe(true);
});
