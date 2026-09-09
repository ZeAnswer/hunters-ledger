import { convertV1, isV1Ability } from '../src/migrate';
import { AbilitySchema } from '../src/schema';

const v1 = {
  id: 'x', name: 'X', source: 'feat', activation: 'declare',
  resources: [{ id: 'x', max: 1, per: 'day' }],
  effects: [
    { id: 'a', when: { kind: 'all', of: [{ kind: 'attack.kind', attackKind: 'ranged' }, { kind: 'log', event: 'miss', target: 'current', scope: 'thisRound' }, { kind: 'target.hasTag', tag: 'aquatic' }, { kind: 'target.hurtAtMost', hurt: 'bloodied' }, { kind: 'param', name: 'types', includesTargetTag: true }, { kind: 'toggle', id: 'x' }, { kind: 'attack.withinFeet', feet: 30 }, { kind: 'resource', id: 'x', remainingAtLeast: 1 }] },
      do: [{ kind: 'bonus', to: 'attack', value: 4, bonusType: 'untyped' }, { kind: 'extraDice', dice: '1d6', damageType: 'fire' }, { kind: 'applyTag', to: 'target', tag: 'flanked', duration: 'endOfNextTurn' }, { kind: 'bonusFromTable', promptId: 'knowledge', perTagCategory: 'creatureType', to: 'damage', bonusType: 'insight', table: [{ upTo: 15, value: 1 }, { value: 2 }] }] },
    { id: 'b', trigger: 'onUse', do: [{ kind: 'consume', resourceId: 'x' }, { kind: 'extraSlot', slot: 'ring' }, { kind: 'attackMode', modeId: 'rs', label: 'RS', base: 'full', extraAttacksAtTop: 1, penalty: -2, attackKind: 'ranged' }] },
  ],
};

test('detects v1 by kind-based effects', () => {
  expect(isV1Ability(v1)).toBe(true);
  expect(isV1Ability(convertV1(v1))).toBe(false);
});

test('converts conditions to selector forms', () => {
  const a = AbilitySchema.parse(convertV1(v1));
  expect(a.effects[0]!.when).toEqual({
    all: [
      { compare: 'attack.kind', op: '=', value: 'ranged' },
      { history: { event: 'miss', by: 'me', vs: 'current', scope: 'thisRound' }, op: '>=', value: 1 },
      { is: 'target.tag.aquatic' },
      { compare: 'target.hurt', op: '>=', value: 'bloodied' },
      { in: 'target.tags', param: 'types' },
      { is: 'battle.toggle.x' },
      { compare: 'target.distance', op: '<=', value: 30 },
      { compare: 'self.resource.x.left', op: '>=', value: 1 },
    ],
  });
});

test('converts effects to verbs and the envelope', () => {
  const a = AbilitySchema.parse(convertV1(v1));
  expect(a.origin).toBe('feat');
  expect(a.resources[0]).toMatchObject({ id: 'x', max: 1, resetOn: 'day', resetTo: 'max' });
  expect(a.effects[0]!.do).toEqual([
    { verb: 'modify', to: 'attack', value: 4, type: 'untyped', mode: 'add' },
    { verb: 'dice', dice: '1d6', damageType: 'fire' },
    { verb: 'tag', to: 'target', tag: 'flanked', duration: 'untilMyNextTurn' },
    { verb: 'modify', to: 'damage', value: { prompt: 'knowledge', per: 'creatureType', table: [{ upTo: 15, value: 1 }, { value: 2 }] }, type: 'insight', mode: 'add' },
  ]);
  expect(a.effects[1]!.do).toEqual([
    { verb: 'resource', id: 'x', op: 'consume', amount: 1 },
    { verb: 'slot', slot: 'ring', count: 1 },
    { verb: 'attack', mode: { id: 'rs', label: 'RS', base: 'full' }, extraAttacks: 1, penaltyAll: -2, attackKind: 'ranged' },
  ]);
});

test('is idempotent on v2 input', () => {
  const once = convertV1(v1);
  expect(convertV1(once)).toEqual(once);
});
