import type { Ability, AttackKind, AttackProfile, Battle, Character, ClassTable, Combatant, Skill, Tag } from './schema';

export type Library = {
  abilities: Record<string, Ability>;
  tags: Record<string, Tag>;
  skills: Record<string, Skill>;
  classTables: Record<string, ClassTable>;
  xpTable: { level: number; xp: number }[];
};

export type AttackCtx = {
  profile: AttackProfile;
  kind: AttackKind;
  /** 1-based attack number within the sequence */
  index: number;
  modeId: string;
  distanceFeet?: number;
};

export type AbilityInstance = Character['abilities'][number];

export type EvalContext = {
  character: Character;
  library: Library;
  battle?: Battle;
  target?: Combatant;
  attack?: AttackCtx;
  /** The character's instance of the ability currently being evaluated (for params). */
  abilityInstance?: AbilityInstance;
};

export const SIZE_ORDER = ['fine', 'diminutive', 'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan', 'colossal'] as const;
export const HURT_ORDER = ['unhurt', 'scratched', 'bloodied', 'nearDeath'] as const;

/** 3.5e size modifier to attack rolls and AC. */
export const SIZE_MOD: Record<(typeof SIZE_ORDER)[number], number> = {
  fine: 8, diminutive: 4, tiny: 2, small: 1, medium: 0, large: -1, huge: -2, gargantuan: -4, colossal: -8,
};

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** All tags on a combatant, including active conditions. */
export function targetTags(target: Combatant): string[] {
  return [...target.tags, ...target.conditions.map((c) => c.tag)];
}

/** The target's tag(s) in a given category, e.g. its creature type. */
export function targetTagsInCategory(ctx: EvalContext, target: Combatant, category: string): string[] {
  return targetTags(target).filter((t) => ctx.library.tags[t]?.category === category);
}

/** Key under which a per-category prompt value is stored, e.g. "knowledge:aberration". */
export function promptKey(ctx: EvalContext, promptId: string, perTagCategory?: string, target = ctx.target): string | undefined {
  if (!perTagCategory) return promptId;
  if (!target) return undefined;
  const cat = targetTagsInCategory(ctx, target, perTagCategory)[0];
  return cat ? `${promptId}:${cat}` : undefined;
}

export function findResourceDef(ctx: EvalContext, resourceId: string) {
  for (const inst of ctx.character.abilities) {
    const def = ctx.library.abilities[inst.abilityId]?.resources?.find((r) => r.id === resourceId);
    if (def) return { def, abilityId: inst.abilityId };
  }
  for (const a of ctx.battle?.situational ?? []) {
    const def = a.resources?.find((r) => r.id === resourceId);
    if (def) return { def, abilityId: a.id };
  }
  return undefined;
}

export function resourceUsed(ctx: EvalContext, resourceId: string, per: 'day' | 'encounter' | 'round'): number {
  if (per === 'day') return ctx.character.resourceState[resourceId]?.used ?? 0;
  if (per === 'encounter') return ctx.battle?.encounterResources[resourceId] ?? 0;
  return ctx.battle?.roundResources[resourceId] ?? 0;
}
