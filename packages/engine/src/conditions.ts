import {
  HURT_ORDER, SIZE_ORDER, findResourceDef, promptKey, resourceUsed, targetTags, targetTagsInCategory, type EvalContext,
} from './context';
import { evalExpr } from './expr';
import { exprVars } from './vars';
import { countLogEvents, findLogEvents, isFirstAttackThisRound } from './log';
import type { Condition } from './schema';

export function evalCondition(cond: Condition, ctx: EvalContext): boolean {
  switch (cond.kind) {
    case 'always': return true;
    case 'all': return cond.of.every((c) => evalCondition(c, ctx));
    case 'any': return cond.of.some((c) => evalCondition(c, ctx));
    case 'not': return !evalCondition(cond.of, ctx);

    case 'target.hasTag': return !!ctx.target && targetTags(ctx.target).includes(cond.tag);
    case 'target.tagIn': return !!ctx.target && targetTags(ctx.target).some((t) => cond.tags.includes(t));
    case 'target.sizeAtLeast':
      return !!ctx.target && SIZE_ORDER.indexOf(ctx.target.size) >= SIZE_ORDER.indexOf(cond.size);
    case 'target.hurtAtMost':
      // "at most bloodied" means the target is at least that hurt (bloodied or worse)
      return !!ctx.target && HURT_ORDER.indexOf(ctx.target.hurt) >= HURT_ORDER.indexOf(cond.hurt);
    case 'target.hasCondition': return !!ctx.target && ctx.target.conditions.some((c) => c.tag === cond.condition);

    case 'self.hasBuff':
      return !!ctx.battle?.activeBuffs.some((b) => b.abilityId === cond.abilityId && b.owner === 'self' && !b.suppressed);
    case 'self.hasCondition': return !!ctx.battle?.selfConditions.some((c) => c.tag === cond.condition);
    case 'self.abilityEnabled':
      return ctx.character.abilities.some((a) => a.abilityId === cond.abilityId && a.enabled) &&
        !ctx.battle?.suppressedAbilities.includes(cond.abilityId);

    case 'attack.kind': return ctx.attack?.kind === cond.attackKind;
    case 'attack.withinFeet': return ctx.attack?.distanceFeet !== undefined && ctx.attack.distanceFeet <= cond.feet;
    case 'attack.isFirstThisRound': return !!ctx.attack && (!ctx.battle || isFirstAttackThisRound(ctx.battle));
    case 'attack.index': return ctx.attack?.index === cond.index;

    case 'log': {
      if (!ctx.battle) return false;
      const target = cond.target ?? 'current';
      if (target === 'current' && !ctx.target) return false;
      const n = countLogEvents(ctx.battle, {
        event: cond.event, scope: cond.scope, abilityId: cond.abilityId,
        targetId: target === 'current' ? ctx.target!.id : undefined,
      });
      return n >= (cond.min ?? 1);
    }

    case 'used': {
      if (cond.scope === 'day') {
        const res = findResourceDef(ctx, cond.abilityId);
        return !!res && resourceUsed(ctx, cond.abilityId, 'day') > 0;
      }
      if (!ctx.battle) return false;
      const scope = cond.scope === 'round' ? 'thisRound' : 'encounter';
      const uses = findLogEvents(ctx.battle, { event: 'use', abilityId: cond.abilityId, scope });
      if (!cond.perTagCategory) return uses.length > 0;
      if (!ctx.target) return false;
      const wanted = new Set(targetTagsInCategory(ctx, ctx.target, cond.perTagCategory));
      return uses.some((u) => {
        const c = ctx.battle!.combatants.find((x) => x.id === u.targetId);
        return !!c && targetTagsInCategory(ctx, c, cond.perTagCategory!).some((t) => wanted.has(t));
      });
    }

    case 'resource': {
      const res = findResourceDef(ctx, cond.id);
      if (!res) return false;
      const max = evalExpr(res.def.max, exprVars(ctx));
      return max - resourceUsed(ctx, cond.id, res.def.per) >= cond.remainingAtLeast;
    }

    case 'toggle': return !!ctx.battle?.toggles[cond.id];

    case 'prompt': {
      const key = promptKey(ctx, cond.id, cond.perTagCategory);
      if (!key) return false;
      const v = ctx.battle?.prompts[key];
      if (v === undefined) return false;
      return cond.atLeast === undefined || v >= cond.atLeast;
    }

    case 'round': {
      const r = ctx.battle?.round ?? 1;
      return (cond.atLeast === undefined || r >= cond.atLeast) && (cond.atMost === undefined || r <= cond.atMost);
    }

    case 'param': {
      if (!ctx.target || !ctx.abilityInstance) return false;
      const chosen = ctx.abilityInstance.paramValues[cond.name] ?? [];
      return targetTags(ctx.target).some((t) => chosen.includes(t));
    }
  }
}
