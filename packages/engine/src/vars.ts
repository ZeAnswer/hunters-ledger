import { abilityMod, type EvalContext } from './context';
import type { ExprVars } from './expr';
import { derivedFromLevels } from './levels';
import { effectiveScores } from './resolve';
import { readSelector } from './selectors';

/** Variables available to pack expressions. Ability mods come from effective scores (items/buffs included) unless rawScores. */
export function exprVars(ctx: EvalContext, opts: { rawScores?: boolean } = {}): ExprVars {
  const s = opts.rawScores ? ctx.character.abilityScores : effectiveScores(ctx);
  const d = derivedFromLevels(ctx.character, ctx.library);
  return {
    ...ctx.character.vars,
    strMod: abilityMod(s.str), dexMod: abilityMod(s.dex), conMod: abilityMod(s.con),
    intMod: abilityMod(s.int), wisMod: abilityMod(s.wis), chaMod: abilityMod(s.cha),
    level: d.level, bab: d.bab, round: ctx.battle?.round ?? 0,
    classLevel: Object.fromEntries(ctx.character.classLevels.map((c) => [c.classId, c.level])),
    prompt: ctx.battle?.prompts ?? {},
    damage: ctx.lastDamage ?? 0,
    resolve: (name: string) => { const v = readSelector(ctx, name); return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : undefined; },
  };
}
