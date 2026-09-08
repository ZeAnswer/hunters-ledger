import type { EvalContext } from './context';
import { evalCondition } from './conditions';
import type { Condition, Effect } from './schema';

function tagLabel(ctx: EvalContext, id: string): string {
  return ctx.library.tags[id]?.label ?? id;
}

/** Human sentence for a single condition (leaf or combinator). */
export function describeCondition(cond: Condition, ctx: EvalContext): string {
  switch (cond.kind) {
    case 'always': return 'always';
    case 'all': return cond.of.map((c) => describeCondition(c, ctx)).join(' and ');
    case 'any': return cond.of.map((c) => describeCondition(c, ctx)).join(' or ');
    case 'not': return `not (${describeCondition(cond.of, ctx)})`;
    case 'target.hasTag': return `target is ${tagLabel(ctx, cond.tag)}`;
    case 'target.tagIn': return `target is ${cond.tags.map((t) => tagLabel(ctx, t)).join(' / ')}`;
    case 'target.sizeAtLeast': return `target is ${cond.size} or larger`;
    case 'target.hurtAtMost': return `target is ${cond.hurt} or worse`;
    case 'target.hasCondition': return `target is ${tagLabel(ctx, cond.condition)}`;
    case 'self.hasBuff': return `${ctx.library.abilities[cond.abilityId]?.name ?? cond.abilityId} is active on you`;
    case 'self.hasCondition': return `you are ${tagLabel(ctx, cond.condition)}`;
    case 'self.abilityEnabled': return `${ctx.library.abilities[cond.abilityId]?.name ?? cond.abilityId} is enabled`;
    case 'attack.kind': return `${cond.attackKind} attack`;
    case 'attack.withinFeet': return `target within ${cond.feet} ft`;
    case 'attack.isFirstThisRound': return 'first attack this round';
    case 'attack.index': return `attack #${cond.index}`;
    case 'log': {
      const what = { hit: 'hit', miss: 'missed', crit: 'critted', use: `used ${cond.abilityId ?? 'ability'}` }[cond.event];
      const who = (cond.target ?? 'current') === 'current' ? 'this target' : 'any target';
      const when = { thisRound: 'this round', lastRound: 'last round', encounter: 'this encounter' }[cond.scope];
      return `${what} ${who} ${when}${cond.min && cond.min > 1 ? ` (${cond.min}+ times)` : ''}`;
    }
    case 'used': {
      const name = ctx.library.abilities[cond.abilityId]?.name ?? cond.abilityId;
      return `${name} already used this ${cond.scope}${cond.perTagCategory ? ` vs this ${cond.perTagCategory}` : ''}`;
    }
    case 'resource': return `${cond.id}: at least ${cond.remainingAtLeast} left`;
    case 'toggle': return `"${cond.id}" declared`;
    case 'prompt': return `${cond.id} entered${cond.atLeast !== undefined ? ` (${cond.atLeast}+)` : ''}`;
    case 'round': return `round ${cond.atLeast ?? 1}${cond.atMost !== undefined ? `-${cond.atMost}` : '+'}`;
    case 'param': return `target is one of your ${cond.name}`;
  }
}

/** Describe the first leaf that makes the condition false; undefined if it passes. */
export function firstFailure(cond: Condition, ctx: EvalContext): string | undefined {
  if (evalCondition(cond, ctx)) return undefined;
  switch (cond.kind) {
    case 'all':
      for (const c of cond.of) {
        const f = firstFailure(c, ctx);
        if (f) return f;
      }
      return describeCondition(cond, ctx);
    case 'any': return `none of: ${cond.of.map((c) => describeCondition(c, ctx)).join(' / ')}`;
    case 'not': return `not (${describeCondition(cond.of, ctx)})`;
    default: return describeCondition(cond, ctx);
  }
}

/** Short summary of what an effect list would grant, e.g. "+2 attack, +2 damage". */
export function summarizeEffects(effects: readonly Effect[]): string {
  const parts: string[] = [];
  for (const e of effects) {
    switch (e.kind) {
      case 'bonus': parts.push(`${typeof e.value === 'number' && e.value >= 0 ? '+' : ''}${e.value} ${e.to}`); break;
      case 'bonusFromTable': parts.push(`+${e.table[0]?.value ?? '?'}..${e.table[e.table.length - 1]?.value ?? '?'} ${e.to}`); break;
      case 'extraDice': parts.push(`+${e.dice}${e.damageType ? ` ${e.damageType}` : ''}`); break;
      case 'ignoreConcealment': parts.push('ignore concealment'); break;
      case 'applyTag': parts.push(`${e.to} gains ${e.tag}`); break;
      case 'consume': parts.push(`uses ${e.resourceId}`); break;
      case 'note': parts.push('note'); break;
      case 'suppress': parts.push(`suppress ${e.abilityId}`); break;
      case 'revealTarget': parts.push('reveal target'); break;
      case 'attackMode': parts.push(`mode ${e.label}`); break;
      case 'extraAttack': parts.push(`+${e.count} attack`); break;
      case 'extraSlot': parts.push(`+${e.count} ${e.slot} slot`); break;
    }
  }
  return parts.join(', ');
}
