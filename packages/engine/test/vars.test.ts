import { exprVars } from '../src/vars';
import { evalExpr } from '../src/expr';
import { makeCtx, makeCharacter } from './fixtures';

test('character vars are exposed to expressions and can be edited per character', () => {
  const ctx = makeCtx({ character: makeCharacter({ vars: { favoredEnemyBonus1: 4, trophyMultiplier: 1 } }) });
  const v = exprVars(ctx);
  expect(evalExpr('favoredEnemyBonus1', v)).toBe(4);
  expect(evalExpr('2 * trophyMultiplier + wisMod', v)).toBe(5);
});

test('built-in vars win over character vars with the same name', () => {
  const ctx = makeCtx({ character: makeCharacter({ vars: { bab: 99 } }) });
  expect(exprVars(ctx).bab).toBe(6);
});
