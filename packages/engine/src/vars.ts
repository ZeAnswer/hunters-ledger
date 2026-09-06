import { abilityMod, type EvalContext } from './context';
import type { ExprVars } from './expr';
import { derivedFromLevels } from './levels';

/** Variables available to pack expressions. */
export function exprVars(ctx: EvalContext): ExprVars {
  const s = ctx.character.abilityScores;
  const d = derivedFromLevels(ctx.character, ctx.library);
  return {
    ...ctx.character.vars,
    strMod: abilityMod(s.str), dexMod: abilityMod(s.dex), conMod: abilityMod(s.con),
    intMod: abilityMod(s.int), wisMod: abilityMod(s.wis), chaMod: abilityMod(s.cha),
    level: d.level, bab: d.bab, round: ctx.battle?.round ?? 0,
    classLevel: Object.fromEntries(ctx.character.classLevels.map((c) => [c.classId, c.level])),
    prompt: ctx.battle?.prompts ?? {},
  };
}
