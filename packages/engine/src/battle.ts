import type { EvalContext } from './context';
import { promptKey } from './context';
import { evalCondition } from './conditions';
import { newId } from './ids';
import type { Ability, Battle, BonusType, Character, Combatant, Duration, Effect, LogEvent, Monster, Size, StatId, Trigger } from './schema';

type Conditioned = { tag: string; expires?: Duration; appliedRound?: number; source?: string };

function nextSeq(battle: Battle): number {
  return (battle.log.at(-1)?.seq ?? 0) + 1;
}

function appendEvent(battle: Battle, e: Omit<LogEvent, 'id' | 'round' | 'seq'> & Partial<Pick<LogEvent, 'round'>>): Battle {
  const event: LogEvent = { id: newId('ev'), round: battle.round, seq: nextSeq(battle), ...e };
  return { ...battle, log: [...battle.log, event] };
}

function withCombatant(battle: Battle, id: string, fn: (c: Combatant) => Combatant): Battle {
  return { ...battle, combatants: battle.combatants.map((c) => (c.id === id ? fn(c) : c)) };
}

function addCondition(list: Conditioned[], c: Conditioned): Conditioned[] {
  return [...list.filter((x) => x.tag !== c.tag), c];
}

function consume(character: Character, battle: Battle, ctx: EvalContext, resourceId: string, amount: number): { character: Character; battle: Battle } {
  const per = findPer(ctx, resourceId);
  if (per === 'day') {
    const used = (character.resourceState[resourceId]?.used ?? 0) + amount;
    return { battle, character: { ...character, resourceState: { ...character.resourceState, [resourceId]: { used } } } };
  }
  const key = per === 'encounter' ? 'encounterResources' : 'roundResources';
  return { character, battle: { ...battle, [key]: { ...battle[key], [resourceId]: (battle[key][resourceId] ?? 0) + amount } } };
}

function findPer(ctx: EvalContext, resourceId: string): 'day' | 'encounter' | 'round' {
  for (const a of [...Object.values(ctx.library.abilities), ...(ctx.battle?.situational ?? [])]) {
    const r = a.resources?.find((x) => x.id === resourceId);
    if (r) return r.per;
  }
  return 'day';
}

/** Apply the effects of a triggered block (onHit/onUse/...). Returns new state. */
function applyTriggered(ctx: EvalContext, state: { battle: Battle; character: Character }, ability: Ability, effects: readonly Effect[], targetId: string | undefined): { battle: Battle; character: Character } {
  let { battle, character } = state;
  for (const e of effects) {
    switch (e.kind) {
      case 'applyTag': {
        const cond: Conditioned = { tag: e.tag, expires: e.duration, appliedRound: battle.round, source: ability.id };
        if (e.to === 'self') battle = { ...battle, selfConditions: addCondition(battle.selfConditions, cond) };
        else if (targetId) battle = withCombatant(battle, targetId, (c) => ({ ...c, conditions: addCondition(c.conditions, cond) }));
        break;
      }
      case 'consume': ({ battle, character } = consume(character, battle, { ...ctx, battle }, e.resourceId, e.amount)); break;
      case 'suppress': if (!battle.suppressedAbilities.includes(e.abilityId)) battle = { ...battle, suppressedAbilities: [...battle.suppressedAbilities, e.abilityId] }; break;
      case 'revealTarget': if (targetId) battle = withCombatant(battle, targetId, (c) => ({ ...c, revealed: true })); break;
      default: break;
    }
  }
  return { battle, character };
}

/** Run every active ability's blocks with the given trigger. */
function runTriggers(ctx: EvalContext, trigger: Trigger, targetId: string | undefined, extra?: Partial<EvalContext>): { battle: Battle; character: Character } {
  let state = { battle: ctx.battle!, character: ctx.character };
  const target = targetId ? state.battle.combatants.find((c) => c.id === targetId) : undefined;
  const suppressed = new Set(state.battle.suppressedAbilities);
  for (const inst of ctx.character.abilities) {
    if (!inst.enabled || suppressed.has(inst.abilityId)) continue;
    const ability = ctx.library.abilities[inst.abilityId];
    if (!ability) continue;
    const ectx: EvalContext = { ...ctx, ...extra, battle: state.battle, character: state.character, target, abilityInstance: inst };
    for (const block of ability.effects) {
      if (block.trigger !== trigger || !evalCondition(block.when, ectx)) continue;
      state = applyTriggered(ectx, state, ability, block.do, targetId);
    }
  }
  return state;
}

export type AttackLogInput = { targetId: string; profileId: string; modeId: string; attackIndex: number; result: 'hit' | 'miss' | 'crit'; damage?: number };

export function logAttack(ctx: EvalContext, input: AttackLogInput): { battle: Battle; character: Character } {
  if (!ctx.battle) throw new Error('No battle');
  const battle = appendEvent(ctx.battle, { kind: 'attack', actor: 'self', ...input });
  const profile = ctx.character.attackProfiles.find((p) => p.id === input.profileId);
  const attack = profile ? { profile, kind: profile.kind, index: input.attackIndex, modeId: input.modeId } : undefined;
  let state = { battle, character: ctx.character };
  const triggers: Trigger[] = input.result === 'miss' ? ['onMiss'] : input.result === 'crit' ? ['onHit', 'onCrit'] : ['onHit'];
  for (const t of triggers) state = runTriggers({ ...ctx, battle: state.battle, character: state.character }, t, input.targetId, attack ? { attack } : {});
  return state;
}

export type UseAbilityInput = { abilityId: string; targetId?: string };

export function useAbility(ctx: EvalContext, input: UseAbilityInput): { battle: Battle; character: Character } {
  if (!ctx.battle) throw new Error('No battle');
  const ability = ctx.library.abilities[input.abilityId] ?? ctx.battle.situational.find((a) => a.id === input.abilityId);
  if (!ability) throw new Error(`Unknown ability "${input.abilityId}"`);
  let battle = appendEvent(ctx.battle, { kind: 'use', actor: 'self', abilityId: ability.id, ...(input.targetId ? { targetId: input.targetId } : {}) });
  let character = ctx.character;

  if (ability.duration) {
    const rounds = typeof ability.duration === 'object' ? ability.duration.rounds : undefined;
    battle = { ...battle, activeBuffs: [...battle.activeBuffs, { instanceId: newId('buff'), abilityId: ability.id, owner: 'self', suppressed: false, ...(rounds !== undefined ? { remainingRounds: rounds } : {}) }] };
  }

  const target = input.targetId ? battle.combatants.find((c) => c.id === input.targetId) : undefined;
  const inst = character.abilities.find((a) => a.abilityId === ability.id);
  const declared: Battle = { ...battle, toggles: { ...battle.toggles, [ability.id]: true } };
  const consumedExplicitly = new Set<string>();
  for (const block of ability.effects) {
    if (block.trigger !== 'onUse') continue;
    const ectx: EvalContext = { ...ctx, battle: declared, character, target, abilityInstance: inst };
    if (!evalCondition(block.when, ectx)) continue;
    for (const e of block.do) if (e.kind === 'consume') consumedExplicitly.add(e.resourceId);
    ({ battle, character } = applyTriggered(ectx, { battle, character }, ability, block.do, input.targetId));
  }
  for (const r of ability.resources ?? []) {
    if (!consumedExplicitly.has(r.id)) ({ battle, character } = consume(character, battle, { ...ctx, battle }, r.id, 1));
  }
  if (ability.activation === 'declare' || ability.activation === 'toggle' || battle.toggles[ability.id] !== undefined) {
    battle = { ...battle, toggles: { ...battle.toggles, [ability.id]: false } };
  }
  return { battle, character };
}

function expired(c: Conditioned, newRound: number): boolean {
  const from = c.appliedRound ?? newRound;
  const d = c.expires;
  if (!d || d === 'untilRemoved' || d === 'encounter') return false;
  if (d === 'endOfRound') return newRound > from;
  if (d === 'endOfNextTurn') return newRound >= from + 2;
  return newRound >= from + d.rounds;
}

export function nextRound(ctx: EvalContext): Battle {
  if (!ctx.battle) throw new Error('No battle');
  const round = ctx.battle.round + 1;
  const declareIds = new Set(
    [...Object.values(ctx.library.abilities), ...ctx.battle.situational].filter((a) => a.activation === 'declare').map((a) => a.id),
  );
  let battle: Battle = {
    ...ctx.battle,
    round,
    activeBuffs: ctx.battle.activeBuffs
      .map((b) => (b.remainingRounds === undefined ? b : { ...b, remainingRounds: b.remainingRounds - 1 }))
      .filter((b) => b.remainingRounds === undefined || b.remainingRounds > 0),
    combatants: ctx.battle.combatants.map((c) => ({ ...c, conditions: c.conditions.filter((x) => !expired(x, round)) })),
    selfConditions: ctx.battle.selfConditions.filter((x) => !expired(x, round)),
    toggles: Object.fromEntries(Object.entries(ctx.battle.toggles).map(([k, v]) => [k, declareIds.has(k) ? false : v])),
    roundResources: {},
  };
  battle = appendEvent(battle, { kind: 'roundStart', actor: 'self' });
  return runTriggers({ ...ctx, battle }, 'onRoundStart', undefined).battle;
}

export type SituationalSpec = {
  label: string;
  target: 'self' | 'all' | string;
  to?: StatId;
  value?: number;
  bonusType?: BonusType;
  tag?: string;
  suppressAbilityId?: string;
  duration?: Duration;
  note?: string;
};

export function addSituational(ctx: EvalContext, spec: SituationalSpec): Battle {
  if (!ctx.battle) throw new Error('No battle');
  let battle = ctx.battle;
  const duration = spec.duration ?? 'encounter';
  if (spec.target === 'self') {
    const effects: Effect[] = [];
    if (spec.to && spec.value !== undefined) effects.push({ kind: 'bonus', to: spec.to, value: spec.value, bonusType: spec.bonusType ?? 'untyped' });
    if (spec.note) effects.push({ kind: 'note', text: spec.note });
    if (spec.suppressAbilityId && !battle.suppressedAbilities.includes(spec.suppressAbilityId)) battle = { ...battle, suppressedAbilities: [...battle.suppressedAbilities, spec.suppressAbilityId] };
    if (spec.tag) battle = { ...battle, selfConditions: addCondition(battle.selfConditions, { tag: spec.tag, expires: duration, appliedRound: battle.round, source: 'situational' }) };
    if (effects.length) {
      const ability: Ability = {
        id: newId('sit'), name: spec.label, source: 'situational', activation: 'passive', enabledByDefault: true,
        effects: [{ id: 'e', trigger: 'always', when: { kind: 'always' }, do: effects }],
      };
      const rounds = typeof duration === 'object' ? duration.rounds : undefined;
      battle = {
        ...battle,
        situational: [...battle.situational, ability],
        activeBuffs: [...battle.activeBuffs, { instanceId: newId('buff'), abilityId: ability.id, owner: 'self', suppressed: false, label: spec.label, ...(rounds !== undefined ? { remainingRounds: rounds } : {}) }],
      };
    }
    return battle;
  }
  const ids = spec.target === 'all' ? battle.combatants.map((c) => c.id) : [spec.target];
  const tag = spec.tag ?? spec.label;
  for (const id of ids) {
    battle = withCombatant(battle, id, (c) => ({ ...c, conditions: addCondition(c.conditions, { tag, expires: duration, appliedRound: battle.round, source: 'situational' }) }));
  }
  return battle;
}

export function setPrompt(ctx: EvalContext, input: { id: string; perTagCategory?: string; value: number; targetId?: string }): Battle {
  if (!ctx.battle) throw new Error('No battle');
  const target = input.targetId ? ctx.battle.combatants.find((c) => c.id === input.targetId) : ctx.target;
  const key = promptKey(ctx, input.id, input.perTagCategory, target);
  if (!key) throw new Error(`Cannot key prompt "${input.id}" by ${input.perTagCategory}: target has no such tag`);
  return { ...ctx.battle, prompts: { ...ctx.battle.prompts, [key]: input.value } };
}

export function editLogEvent(battle: Battle, id: string, patch: Partial<LogEvent>): Battle {
  return { ...battle, log: battle.log.map((e) => (e.id === id ? { ...e, ...patch, id: e.id, editedAt: new Date().toISOString() } : e)) };
}

export function deleteLogEvent(battle: Battle, id: string): Battle {
  return { ...battle, log: battle.log.filter((e) => e.id !== id) };
}

export function undoLastEvent(battle: Battle): Battle {
  return { ...battle, log: battle.log.slice(0, -1) };
}

export function longRest(character: Character): Character {
  return { ...character, resourceState: {} };
}

export type AddCombatantInput = { monster: Monster; name?: string } | { name: string; tags?: string[]; size?: Size };

export function addCombatant(battle: Battle, input: AddCombatantInput): Battle {
  const base = 'monster' in input ? input.name ?? input.monster.name : input.name;
  const taken = new Set(battle.combatants.map((c) => c.name));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  const combatant: Combatant = {
    id: newId('cb'), name, hurt: 'unhurt', conditions: [], dead: false, revealed: false,
    ...('monster' in input
      ? { monsterId: input.monster.id, tags: [...input.monster.tags], size: input.monster.size }
      : { tags: input.tags ?? [], size: input.size ?? 'medium' }),
  };
  return { ...battle, combatants: [...battle.combatants, combatant] };
}

export function newBattle(name = 'Battle'): Battle {
  return {
    id: newId('battle'), name, startedAt: new Date().toISOString(), round: 1, combatants: [], activeBuffs: [], situational: [],
    suppressedAbilities: [], selfConditions: [], toggles: {}, encounterResources: {}, roundResources: {}, prompts: {}, log: [], ended: false,
  };
}
