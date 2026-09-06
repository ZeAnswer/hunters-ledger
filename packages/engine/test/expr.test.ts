import { evalExpr } from '../src/expr';

const vars = {
  wisMod: 3, strMod: 1, dexMod: 3, mhLevel: 1, trophyMultiplier: 1, level: 6, bab: 5,
  classLevel: { ranger: 5, monsterHunter: 1 },
  prompt: { knowledgeCheck: 22 },
};

test('numeric literal evaluates to itself', () => {
  expect(evalExpr(4, vars)).toBe(4);
  expect(evalExpr('4', vars)).toBe(4);
});

test('reads named variables', () => {
  expect(evalExpr('wisMod', vars)).toBe(3);
});

test('arithmetic with precedence', () => {
  expect(evalExpr('2 * mhLevel + wisMod', vars)).toBe(5);
  expect(evalExpr('(1 + 2) * 3 - 4', vars)).toBe(5);
  expect(evalExpr('-wisMod', vars)).toBe(-3);
});

test('floor, min, max functions', () => {
  expect(evalExpr('floor(level / 4)', vars)).toBe(1);
  expect(evalExpr('min(wisMod, 2)', vars)).toBe(2);
  expect(evalExpr('max(mhLevel, 3)', vars)).toBe(3);
});

test('classLevel and prompt lookups', () => {
  expect(evalExpr('classLevel(ranger)', vars)).toBe(5);
  expect(evalExpr('classLevel(wizard)', vars)).toBe(0);
  expect(evalExpr('prompt(knowledgeCheck)', vars)).toBe(22);
  expect(evalExpr('prompt(missing)', vars)).toBe(0);
});

test('unknown variable throws with its name', () => {
  expect(() => evalExpr('bogus + 1', vars)).toThrow(/bogus/);
});
