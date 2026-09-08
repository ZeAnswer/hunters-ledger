import { resolveStat, resolveAttack, effectiveScores } from '../src/resolve';
import { exprVars } from '../src/vars';
import { makeCtx, makeCharacter, makeAbility, makeBattle } from './fixtures';
import type { Ability } from '../src/schema';

const belt = makeAbility({ id: 'belt-str-2', name: 'Belt of Strength +2', source: 'item', effects: [{ id: 'b', do: [{ kind: 'bonus', to: 'ability.str', value: 2, bonusType: 'enhancement' }] }] });
const belt4 = makeAbility({ id: 'belt-str-4', name: 'Belt of Strength +4', source: 'item', effects: [{ id: 'b', do: [{ kind: 'bonus', to: 'ability.str', value: 4, bonusType: 'enhancement' }] }] });
const catsGrace = makeAbility({ id: 'cats-grace', source: 'buff', duration: { rounds: 10 }, effects: [{ id: 'c', do: [{ kind: 'bonus', to: 'ability.dex', value: 4, bonusType: 'enhancement' }] }] });

function ctxWith(abilities: Ability[]) {
  const c = makeCtx({ character: makeCharacter({ abilities: abilities.map((a) => ({ abilityId: a.id, enabled: true, paramValues: {} })), skills: { swim: { ranks: 2 } } }) });
  for (const a of abilities) c.library.abilities[a.id] = a;
  return c;
}

test('ability.str bonus raises the effective score with a breakdown', () => {
  const r = resolveStat(ctxWith([belt]), 'ability.str');
  expect(r.total).toBe(14);
  expect(r.entries.map((e) => e.label)).toEqual(['Base score', 'Belt of Strength +2']);
  expect(effectiveScores(ctxWith([belt])).str).toBe(14);
});

test('same-type score bonuses do not stack', () => {
  expect(resolveStat(ctxWith([belt, belt4]), 'ability.str').total).toBe(16);
});

test('derived numbers use effective scores: melee attack, str skills, expression vars', () => {
  const c = ctxWith([belt]);
  expect(resolveAttack(c, { profileId: 'sword', modeId: 'single' }).attacks[0]!.attackBonus).toBe(8); // 6 + str mod 2
  expect(resolveStat(c, 'skill.swim').total).toBe(4); // 2 ranks + 2
  expect(exprVars(c).strMod).toBe(2);
});

test('a dex buff raises AC, reflex, initiative and ranged attack', () => {
  const c = ctxWith([catsGrace]);
  c.battle = makeBattle({ activeBuffs: [{ instanceId: 'x', abilityId: 'cats-grace', owner: 'self', suppressed: false }] });
  expect(resolveStat(c, 'ability.dex').total).toBe(20);
  expect(resolveStat(c, 'ac').total).toBe(15);
  expect(resolveStat(c, 'save.ref').total).toBe(9);
  expect(resolveStat(c, 'init').total).toBe(5);
  expect(resolveAttack(c, { profileId: 'bow', modeId: 'single' }).attacks[0]!.attackBonus).toBe(12);
});

test('a bonus expressed with an ability modifier does not recurse forever', () => {
  const weird = makeAbility({ id: 'weird', effects: [{ id: 'w', do: [{ kind: 'bonus', to: 'ability.str', value: 'wisMod' }] }] });
  expect(resolveStat(ctxWith([weird]), 'ability.str').total).toBe(15);
});

test('a Con bonus raises max HP retroactively for every level in the ledger', () => {
  const amulet = makeAbility({ id: 'amulet-con', source: 'item', effects: [{ id: 'a', do: [{ kind: 'bonus', to: 'ability.con', value: 2, bonusType: 'enhancement' }] }] });
  const history = [1, 2, 3].map((level) => ({ level, classId: 'ranger', hpRolled: 8, skillPointsSpent: {}, featsTaken: [] }));
  const c = makeCtx({ character: makeCharacter({ levelHistory: history, abilities: [{ abilityId: 'amulet-con', enabled: true, paramValues: {} }] }) });
  c.library.abilities['amulet-con'] = amulet;
  const r = resolveStat(c, 'hp.max');
  expect(r.total).toBe(24 + 3 * 2); // con 12 → 14 with amulet: +2 per level
  expect(r.entries.map((e) => e.label)).toEqual(['Hit dice rolled', 'CON mod × 3 levels']);
});
