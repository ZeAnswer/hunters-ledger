import { useMemo } from 'react';
import type { Condition, EvalContext } from '@hl/engine';
import { useStore } from './store';

export function useCtx(): EvalContext | undefined {
  const character = useStore((s) => s.character);
  const library = useStore((s) => s.library);
  const battle = useStore((s) => s.battle);
  const targetId = useStore((s) => s.targetId);
  return useMemo(() => {
    if (!character) return undefined;
    const target = battle?.combatants.find((c) => c.id === targetId);
    return { character, library, ...(battle ? { battle } : {}), ...(target ? { target } : {}) };
  }, [character, library, battle, targetId]);
}

/** Every manual toggle id referenced by the character's active abilities (conditions `is battle.toggle.<id>`), with declare abilities marked. */
export function collectToggles(ctx: EvalContext): { id: string; abilities: string[]; declare: boolean }[] {
  const map = new Map<string, { abilities: Set<string>; declare: boolean }>();
  const walk = (c: Condition, abilityName: string, declareId: string | undefined) => {
    if ('is' in c && c.is.startsWith('battle.toggle.')) {
      const id = c.is.slice('battle.toggle.'.length);
      const e = map.get(id) ?? { abilities: new Set(), declare: false };
      e.abilities.add(abilityName);
      if (declareId === id) e.declare = true;
      map.set(id, e);
    } else if ('all' in c) c.all.forEach((x) => walk(x, abilityName, declareId));
    else if ('any' in c) c.any.forEach((x) => walk(x, abilityName, declareId));
    else if ('none' in c) c.none.forEach((x) => walk(x, abilityName, declareId));
    else if ('count' in c) c.count.forEach((x) => walk(x, abilityName, declareId));
    else if ('not' in c) walk(c.not, abilityName, declareId);
  };
  const suppressed = new Set(ctx.battle?.suppressedAbilities ?? []);
  for (const inst of ctx.character.abilities) {
    if (!inst.enabled || suppressed.has(inst.abilityId)) continue;
    const a = ctx.library.abilities[inst.abilityId];
    if (!a) continue;
    for (const b of a.effects) walk(b.when, a.name, a.activation === 'declare' ? a.id : undefined);
  }
  return [...map.entries()].map(([id, e]) => ({ id, abilities: [...e.abilities], declare: e.declare }));
}
