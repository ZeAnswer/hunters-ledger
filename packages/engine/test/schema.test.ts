import { AbilitySchema, PackSchema, ConditionSchema } from '../src/schema';

const woodlandArcher = {
  id: 'woodland-archer',
  name: 'Woodland Archer',
  origin: 'feat',
  effects: [
    {
      id: 'adjust-for-range',
      label: 'Adjust for Range',
      when: { all: [{ compare: 'attack.kind', op: '=', value: 'ranged' }, { history: { event: 'miss', vs: 'current', scope: 'thisRound' } }] },
      do: [{ verb: 'modify', to: 'attack', value: 4 }],
    },
  ],
};

test('accepts a well-formed ability', () => {
  expect(AbilitySchema.safeParse(woodlandArcher).success).toBe(true);
});

test('rejects unknown condition forms and bad selectors', () => {
  expect(ConditionSchema.safeParse({ kind: 'target.isRed' }).success).toBe(false);
  expect(ConditionSchema.safeParse({ is: 'nowhere.x' }).success).toBe(false);
  expect(ConditionSchema.safeParse({ is: 'target.tag.red' }).success).toBe(true);
});

test('rejects effect missing required field', () => {
  const bad = { ...woodlandArcher, effects: [{ id: 'x', do: [{ verb: 'modify', value: 1 }] }] };
  expect(AbilitySchema.safeParse(bad).success).toBe(false);
});

test('defaults: type untyped, mode add, trigger always, when always, envelope defaults', () => {
  const a = AbilitySchema.parse({ ...woodlandArcher, effects: [{ id: 'e', do: [{ verb: 'modify', to: 'damage', value: 2 }] }] });
  const eff = a.effects[0]!;
  expect(eff.trigger).toBe('always');
  expect(eff.when).toEqual({ all: [] });
  expect(eff.do[0]).toMatchObject({ type: 'untyped', mode: 'add' });
  expect(a).toMatchObject({ binding: 'none', activation: 'passive', cost: [], resources: [], grants: [] });
});

test('pack parses with nested abilities and tags', () => {
  const r = PackSchema.safeParse({ id: 'p', name: 'P', version: 1, tags: [{ id: 'aquatic', label: 'Aquatic', category: 'habitat' }], abilities: [woodlandArcher] });
  expect(r.success).toBe(true);
});
