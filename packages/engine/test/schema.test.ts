import { AbilitySchema, PackSchema, ConditionSchema } from '../src/schema';

const woodlandArcher = {
  id: 'woodland-archer',
  name: 'Woodland Archer',
  source: 'feat',
  activation: 'passive',
  enabledByDefault: true,
  effects: [
    {
      id: 'adjust-for-range',
      label: 'Adjust for Range',
      when: {
        kind: 'all',
        of: [
          { kind: 'attack.kind', attackKind: 'ranged' },
          { kind: 'log', event: 'miss', target: 'current', scope: 'thisRound' },
        ],
      },
      do: [{ kind: 'bonus', to: 'attack', value: 4, bonusType: 'untyped' }],
    },
  ],
};

test('accepts a well-formed ability', () => {
  const r = AbilitySchema.safeParse(woodlandArcher);
  expect(r.success).toBe(true);
});

test('rejects unknown condition kind', () => {
  const r = ConditionSchema.safeParse({ kind: 'target.isRed' });
  expect(r.success).toBe(false);
});

test('rejects effect missing required field', () => {
  const bad = { ...woodlandArcher, effects: [{ id: 'x', do: [{ kind: 'bonus', value: 1 }] }] };
  expect(AbilitySchema.safeParse(bad).success).toBe(false);
});

test('defaults: bonusType untyped, trigger always, when always', () => {
  const a = AbilitySchema.parse({ ...woodlandArcher, effects: [{ id: 'e', do: [{ kind: 'bonus', to: 'damage', value: 2 }] }] });
  const eff = a.effects[0]!;
  expect(eff.trigger).toBe('always');
  expect(eff.when).toEqual({ kind: 'always' });
  expect(eff.do[0]).toMatchObject({ bonusType: 'untyped' });
});

test('pack parses with nested abilities and tags', () => {
  const r = PackSchema.safeParse({
    id: 'p', name: 'P', version: 1,
    tags: [{ id: 'aquatic', label: 'Aquatic', category: 'habitat' }],
    abilities: [woodlandArcher],
  });
  expect(r.success).toBe(true);
});
