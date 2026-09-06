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

/** Every manual toggle id referenced by the character's active abilities, with the ability that uses it. */
export function collectToggles(ctx: EvalContext): { id: string; abilities: string[]; declare: boolean }[] {
  const map = new Map<string, { abilities: Set<string>; declare: boolean }>();
  const walk = (c: Condition, abilityName: string, declareId: string | undefined) => {
    if (c.kind === 'toggle') {
      const e = map.get(c.id) ?? { abilities: new Set(), declare: false };
      e.abilities.add(abilityName);
      if (declareId === c.id) e.declare = true;
      map.set(c.id, e);
    } else if (c.kind === 'all' || c.kind === 'any') c.of.forEach((x) => walk(x, abilityName, declareId));
    else if (c.kind === 'not') walk(c.of, abilityName, declareId);
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
