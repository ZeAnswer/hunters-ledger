import { logAttack, useAbility, nextRound, addSituational, editLogEvent, deleteLogEvent, undoLastEvent, longRest, setPrompt, addCombatant } from '../src/battle';
import { resolveAttack, availableActions } from '../src/resolve';
import { makeCtx, makeBattle, makeCombatant, makeAbility, makeCharacter } from './fixtures';

const distracting = makeAbility({
  id: 'distracting-attack', name: 'Distracting Attack',
  effects: [{ id: 'flank', trigger: 'onHit', do: [{ kind: 'applyTag', to: 'target', tag: 'flanked', duration: 'endOfNextTurn' }] }],
});
const sneak = makeAbility({ id: 'sneak', effects: [{ id: 's', when: { kind: 'target.hasCondition', condition: 'flanked' }, do: [{ kind: 'extraDice', dice: '1d6', label: 'Sneak' }] }] });
const monsterBlow = makeAbility({
  id: 'monster-blow', name: 'Monster Blow', source: 'class', activation: 'declare',
  resources: [{ id: 'monster-blow', max: 1, per: 'day' }],
  effects: [{ id: 'mb', trigger: 'onUse', do: [{ kind: 'consume', resourceId: 'monster-blow' }] }],
});
const haste = makeAbility({ id: 'haste', name: 'Haste', source: 'buff', duration: { rounds: 2 }, effects: [{ id: 'h', do: [{ kind: 'bonus', to: 'attack', value: 1, bonusType: 'dodge' }] }] });
const bootsOfSpeed = makeAbility({
  id: 'boots-of-speed', name: 'Boots of Speed', source: 'item', activation: { action: 'free' },
  resources: [{ id: 'boots-rounds', label: 'Haste rounds', max: 10, per: 'day' }],
  effects: [{ id: 'go', trigger: 'onUse', do: [{ kind: 'consume', resourceId: 'boots-rounds', amount: 2 }, { kind: 'applyTag', to: 'self', tag: 'hasted', duration: { rounds: 2 } }] }],
});
const monsterKnowledge = makeAbility({
  id: 'monster-knowledge', name: 'Monster Knowledge', activation: { action: 'standard' },
  effects: [{ id: 'r', trigger: 'onUse', when: { kind: 'prompt', id: 'knowledge', perTagCategory: 'creatureType', atLeast: 16 }, do: [{ kind: 'revealTarget' }] }],
});

const chuul = makeCombatant({ id: 'c1', name: 'Chuul', tags: ['aberration', 'aquatic'], size: 'large' });

function ctx() {
  const c = makeCtx({
    character: makeCharacter({ abilities: ['distracting-attack', 'sneak', 'monster-blow', 'boots-of-speed', 'monster-knowledge'].map((id) => ({ abilityId: id, enabled: true, paramValues: {} })) }),
    battle: makeBattle({ combatants: [chuul] }),
    target: chuul,
  });
  for (const a of [distracting, sneak, monsterBlow, haste, bootsOfSpeed, monsterKnowledge]) c.library.abilities[a.id] = a;
  return c;
}

test('logAttack appends an attack event with round and sequence', () => {
  const c = ctx();
  const { battle } = logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'miss' });
  expect(battle.log).toHaveLength(1);
  expect(battle.log[0]).toMatchObject({ kind: 'attack', round: 1, seq: 1, targetId: 'c1', result: 'miss', attackIndex: 1 });
  expect(c.battle!.log).toHaveLength(0); // input not mutated
});

test('onHit trigger applies a condition to the target that later effects can see', () => {
  const c = ctx();
  const { battle } = logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'hit' });
  const target = battle.combatants[0]!;
  expect(target.conditions).toEqual([{ tag: 'flanked', expires: 'endOfNextTurn', appliedRound: 1, source: 'distracting-attack' }]);
  const r = resolveAttack({ ...c, battle, target }, { profileId: 'bow', modeId: 'full' });
  expect(r.attacks[0]!.damage.dice.some((d) => d.label === 'Sneak')).toBe(true);
});

test('miss does not fire onHit triggers', () => {
  const c = ctx();
  const { battle } = logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'miss' });
  expect(battle.combatants[0]!.conditions).toEqual([]);
});

test('useAbility logs, consumes per-day charge on the character and clears the declare toggle', () => {
  const c = ctx();
  c.battle!.toggles['monster-blow'] = true;
  const { battle, character } = useAbility(c, { abilityId: 'monster-blow', targetId: 'c1' });
  expect(battle.log[0]).toMatchObject({ kind: 'use', abilityId: 'monster-blow', targetId: 'c1' });
  expect(character.resourceState['monster-blow']).toEqual({ used: 1 });
  expect(battle.toggles['monster-blow']).toBe(false);
  expect(availableActions({ ...c, battle, character }).find((a) => a.abilityId === 'monster-blow')!.usable).toBe(false);
});

test('useAbility with a buff ability adds an active buff with its duration', () => {
  const c = ctx();
  const { battle } = useAbility(c, { abilityId: 'haste' });
  expect(battle.activeBuffs).toEqual([expect.objectContaining({ abilityId: 'haste', owner: 'self', remainingRounds: 2 })]);
});

test('useAbility onUse effects: consume amount, self condition with rounds duration, reveal target', () => {
  const c = ctx();
  const r1 = useAbility(c, { abilityId: 'boots-of-speed' });
  expect(r1.character.resourceState['boots-rounds']).toEqual({ used: 2 });
  expect(r1.battle.selfConditions).toEqual([{ tag: 'hasted', expires: { rounds: 2 }, appliedRound: 1, source: 'boots-of-speed' }]);

  const withPrompt = setPrompt(c, { id: 'knowledge', perTagCategory: 'creatureType', value: 18 });
  const r2 = useAbility({ ...c, battle: withPrompt }, { abilityId: 'monster-knowledge', targetId: 'c1' });
  expect(r2.battle.combatants[0]!.revealed).toBe(true);
  expect(r2.battle.prompts).toEqual({ 'knowledge:aberration': 18 });

  const r3 = useAbility(c, { abilityId: 'monster-knowledge', targetId: 'c1' });
  expect(r3.battle.combatants[0]!.revealed).toBe(false);
});

test('nextRound increments, logs roundStart, ticks buffs and expires conditions', () => {
  const c = ctx();
  let battle = useAbility(c, { abilityId: 'haste' }).battle;
  battle = logAttack({ ...c, battle }, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'hit' }).battle;
  battle = useAbility({ ...c, battle }, { abilityId: 'boots-of-speed' }).battle;
  battle.toggles['monster-blow'] = true;
  battle.toggles['in-aura'] = true;
  battle.roundResources['x'] = 1;

  const r2 = nextRound({ ...c, battle });
  expect(r2.round).toBe(2);
  expect(r2.log.at(-1)).toMatchObject({ kind: 'roundStart', round: 2 });
  expect(r2.activeBuffs[0]!.remainingRounds).toBe(1);
  expect(r2.combatants[0]!.conditions).toHaveLength(1); // endOfNextTurn: still on during round 2
  expect(r2.selfConditions).toHaveLength(1);
  expect(r2.toggles['monster-blow']).toBe(false); // declare toggles reset
  expect(r2.toggles['in-aura']).toBe(true); // manual toggles persist
  expect(r2.roundResources).toEqual({});

  const r3 = nextRound({ ...c, battle: r2 });
  expect(r3.round).toBe(3);
  expect(r3.activeBuffs).toEqual([]); // haste expired
  expect(r3.combatants[0]!.conditions).toEqual([]); // flanked expired
  expect(r3.selfConditions).toEqual([]);
});

test('addSituational on self creates an ability + buff that affects attacks; on a combatant adds a condition', () => {
  const c = ctx();
  const b1 = addSituational(c, { label: 'DM: darkness', target: 'self', to: 'attack', value: -2, duration: { rounds: 3 } });
  expect(b1.situational).toHaveLength(1);
  expect(b1.activeBuffs[0]).toMatchObject({ abilityId: b1.situational[0]!.id, remainingRounds: 3 });
  expect(resolveAttack({ ...c, battle: b1 }, { profileId: 'bow', modeId: 'single' }).attacks[0]!.attackBonus).toBe(8);

  const b2 = addSituational(c, { label: 'Entangled', target: 'c1', tag: 'entangled', duration: 'untilRemoved' });
  expect(b2.combatants[0]!.conditions).toEqual([{ tag: 'entangled', expires: 'untilRemoved', appliedRound: 1, source: 'situational' }]);
});

test('log edit, delete and undo', () => {
  const c = ctx();
  let battle = logAttack(c, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 1, result: 'miss' }).battle;
  battle = logAttack({ ...c, battle }, { targetId: 'c1', profileId: 'bow', modeId: 'full', attackIndex: 2, result: 'hit', damage: 7 }).battle;
  const id = battle.log[0]!.id;
  const edited = editLogEvent(battle, id, { result: 'hit', damage: 5 });
  expect(edited.log[0]).toMatchObject({ result: 'hit', damage: 5 });
  expect(edited.log[0]!.editedAt).toBeDefined();
  expect(deleteLogEvent(battle, id).log).toHaveLength(1);
  expect(undoLastEvent(battle).log).toHaveLength(1);
  expect(undoLastEvent(battle).log[0]!.id).toBe(id);
});

test('longRest resets per-day resources', () => {
  const c = ctx();
  c.character.resourceState = { 'monster-blow': { used: 1 }, 'boots-rounds': { used: 6 } };
  expect(longRest(c.character).resourceState).toEqual({});
});

test('addCombatant from a monster copies tags and size, numbers duplicate names', () => {
  const c = ctx();
  const monster = { id: 'gargoyle', name: 'Gargoyle', tags: ['monstrous-humanoid', 'earth'], size: 'medium' as const, lore: { sections: [] } };
  let battle = addCombatant(c.battle!, { monster });
  battle = addCombatant(battle, { monster });
  expect(battle.combatants.slice(1).map((x) => x.name)).toEqual(['Gargoyle', 'Gargoyle 2']);
  expect(battle.combatants[1]).toMatchObject({ monsterId: 'gargoyle', tags: ['monstrous-humanoid', 'earth'], size: 'medium' });
  const quick = addCombatant(battle, { name: 'Red thing', tags: ['red'], size: 'huge' });
  expect(quick.combatants.at(-1)).toMatchObject({ name: 'Red thing', tags: ['red'], size: 'huge', hurt: 'unhurt' });
});
