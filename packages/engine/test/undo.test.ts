import { logAttack, undoEvent } from '../src/battle';
import { resolveAttack } from '../src/resolve';
import { readSelector } from '../src/selectors';
import { evalExpr } from '../src/expr';
import { exprVars } from '../src/vars';
import { makeCtx, makeCharacter, makeAbility, makeBattle, makeCombatant } from './fixtures';

const woodland = makeAbility({
  id: 'woodland', name: 'Woodland Archer', origin: 'feat',
  effects: [{ id: 'adjust', label: 'Adjust for Range', when: { all: [{ compare: 'attack.kind', op: '=', value: 'ranged' }, { history: { event: 'miss', vs: 'current', scope: 'thisRound' } }] }, do: [{ verb: 'modify', to: 'attack', value: '4 * sel(history.miss.me.current.thisRound)' }] }],
});
const distracting = makeAbility({ id: 'distracting', origin: 'classFeature', effects: [{ id: 'f', trigger: 'onHit', do: [{ verb: 'tag', to: 'target', tag: 'flanked', duration: 'untilMyNextTurn' }] }] });

function ctx() {
  const c = makeCtx({ character: makeCharacter({ abilities: [{ abilityId: 'woodland', enabled: true, paramValues: {} }, { abilityId: 'distracting', enabled: true, paramValues: {} }] }), battle: makeBattle({ combatants: [makeCombatant({ id: 'c1', tags: ['aberration'] })] }) });
  c.library.abilities['woodland'] = woodland; c.library.abilities['distracting'] = distracting;
  c.target = c.battle!.combatants[0];
  return c;
}

test('history selector counts events and is usable in expressions; Adjust for Range stacks per miss', () => {
  let c = ctx();
  expect(readSelector(c, 'history.miss.me.current.thisRound')).toBe(0);
  c = { ...c, ...logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'miss' }) };
  c = { ...c, ...logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 2, result: 'miss' }) };
  c.target = c.battle!.combatants[0];
  expect(evalExpr('sel(history.miss.me.current.thisRound)', exprVars(c))).toBe(2);
  expect(resolveAttack(c, { profileId: 'bow', modeId: 'full' }).attacks[0]!.attackBonus).toBe(10 + 8);
});

test('logAttack stores a snapshot and what it changed; undoEvent reverts the change and removes the event', () => {
  let c = ctx();
  const r = logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'hit', damage: 9 }, { attackBonus: 10, damageText: '1d8 +2' });
  c = { ...c, ...r };
  const ev = c.battle!.log.at(-1)!;
  expect(ev.snapshot).toEqual({ attackBonus: 10, damageText: '1d8 +2' });
  expect(c.battle!.combatants[0]!.conditions.map((x) => x.tag)).toEqual(['flanked']);
  expect(ev.undo?.targetConditions).toEqual([{ combatantId: 'c1', tag: 'flanked' }]);
  const u = undoEvent(c, ev.id);
  expect(u.battle.log).toEqual([]);
  expect(u.battle.combatants[0]!.conditions).toEqual([]);
});
