import type { EvalContext } from './context';
import { promptKey, resourceUsed, type ResetOn } from './context';
import { evalCondition } from './conditions';
import { evalExpr } from './expr';
import { newId } from './ids';
import type { Ability, Battle, BonusType, Character, Combatant, Duration, Effect, LogEvent, Monster, Size, StatId, Trigger } from './schema';
import { exprVars } from './vars';

type Conditioned = { tag: string; expires?: Duration; appliedRound?: number; source?: string };
type State = { battle: Battle; character: Character };

function nextSeq(battle: Battle): number {
  return (battle.log.at(-1)?.seq ?? 0) + 1;
}

function appendEvent(battle: Battle, e: Omit<LogEvent, 'id' | 'round' | 'seq'>): Battle {
  const event: LogEvent = { id: newId('ev'), round: battle.round, seq: nextSeq(battle), ...e };
  return { ...battle, log: [...battle.log, event] };
}

function withCombatant(battle: Battle, id: string, fn: (c: Combatant) => Combatant): Battle {
  return { ...battle, combatants: battle.combatants.map((c) => (c.id === id ? fn(c) : c)) };
}

function addCondition(list: Conditioned[], c: Conditioned): Conditioned[] {
  return [...list.filter((x) => x.tag !== c.tag), c];
}

function findPer(ctx: EvalContext, resourceId: string): ResetOn {
  for (const a of [...Object.values(ctx.library.abilities), ...(ctx.battle?.situational ?? [])]) {
    const r = a.resources.find((x) => x.id === resourceId);
    if (r) return r.resetOn;
  }
  return 'day';
}

function changeResource(ctx: EvalContext, state: State, resourceId: string, delta: number, set?: number): State {
  const per = findPer({ ...ctx, battle: state.battle }, resourceId);
  const current = resourceUsed({ ...ctx, battle: state.battle, character: state.character }, resourceId, per);
  const used = Math.max(0, set !== undefined ? set : current + delta);
  if (per === 'round' || per === 'encounter') {
    const key = per === 'encounter' ? 'encounterResources' : 'roundResources';
    return { ...state, battle: { ...state.battle, [key]: { ...state.battle[key], [resourceId]: used } } };
  }
  return { ...state, character: { ...state.character, resourceState: { ...state.character.resourceState, [resourceId]: { used } } } };
}

/** Apply the effects of a triggered block (onHit/onUse/…). */
function applyTriggered(ctx: EvalContext, state: State, ability: Ability, effects: readonly Effect[], targetId: string | undefined): State {
  let { battle, character } = state;
  const vars = exprVars({ ...ctx, battle, character });
  for (const e of effects) {
    switch (e.verb) {
      case 'tag': {
        const cond: Conditioned = { tag: e.tag, expires: e.duration, appliedRound: battle.round, source: ability.id };
        if (e.to === 'self') battle = { ...battle, selfConditions: addCondition(battle.selfConditions, cond) };
        else if (e.to === 'allEnemies') battle = { ...battle, combatants: battle.combatants.map((c) => ({ ...c, conditions: addCondition(c.conditions, cond) })) };
        else if (targetId) battle = withCombatant(battle, targetId, (c) => ({ ...c, conditions: addCondition(c.conditions, cond) }));
        break;
      }
      case 'resource': {
        const amount = evalExpr(e.amount, vars);
        ({ battle, character } = changeResource(ctx, { battle, character }, e.id, e.op === 'restore' ? -amount : amount, e.op === 'set' ? amount : undefined));
        break;
      }
      case 'suppress': if (!battle.suppressedAbilities.includes(e.ability)) battle = { ...battle, suppressedAbilities: [...battle.suppressedAbilities, e.ability] }; break;
      case 'reveal': if (targetId) battle = withCombatant(battle, targetId, (c) => ({ ...c, revealed: true })); break;
      case 'grant': {
        const g = ctx.library.abilities[e.ability];
        const dur = e.duration ?? g?.duration;
        const rounds = typeof dur === 'object' && 'rounds' in dur ? evalExpr(dur.rounds, vars) : undefined;
        if (!battle.activeBuffs.some((b) => b.abilityId === e.ability)) battle = { ...battle, activeBuffs: [...battle.activeBuffs, { instanceId: newId('buff'), abilityId: e.ability, owner: 'self', suppressed: false, ...(rounds !== undefined ? { remainingRounds: rounds } : {}) }] };
        break;
      }
      case 'hp': {
        const n = evalExpr(e.amount, vars);
        const hp = { ...character.hp };
        if (e.op === 'damage') { const t = Math.min(hp.temp, n); hp.temp -= t; hp.current -= n - t; }
        else if (e.op === 'heal') hp.current = Math.min(hp.max, hp.current + n);
        else hp.temp = Math.max(hp.temp, n);
        character = { ...character, hp };
        break;
      }
      default: break;
    }
  }
  return { battle, character };
}

/** Run every active ability's blocks with the given trigger. */
function runTriggers(ctx: EvalContext, trigger: Trigger, targetId: string | undefined, extra?: Partial<EvalContext>): State {
  let state: State = { battle: ctx.battle!, character: ctx.character };
  const target = targetId ? state.battle.combatants.find((c) => c.id === targetId) : undefined;
  const suppressed = new Set(state.battle.suppressedAbilities);
  const candidates: { ability: Ability; inst: Character['abilities'][number] | undefined }[] = [];
  for (const inst of ctx.character.abilities) {
    if (!inst.enabled || suppressed.has(inst.abilityId)) continue;
    const ability = ctx.library.abilities[inst.abilityId];
    if (!ability) continue;
    if (ability.activation === 'toggle' && !state.battle.activeAbilities.includes(ability.id)) continue;
    candidates.push({ ability, inst });
    for (const gid of ability.grants) { const g = ctx.library.abilities[gid]; if (g && !suppressed.has(gid) && !(g.activation === 'toggle' && !state.battle.activeAbilities.includes(gid))) candidates.push({ ability: g, inst }); }
  }
  for (const b of state.battle.activeBuffs) {
    if (b.owner !== 'self' || b.suppressed || suppressed.has(b.abilityId)) continue;
    const ability = ctx.library.abilities[b.abilityId] ?? state.battle.situational.find((a) => a.id === b.abilityId);
    if (ability) candidates.push({ ability, inst: undefined });
  }
  for (const { ability, inst } of candidates) {
    const ectx: EvalContext = { ...ctx, ...extra, battle: state.battle, character: state.character, target, abilityInstance: inst };
    for (const block of ability.effects) {
      if (block.trigger !== trigger || !evalCondition(block.when, ectx)) continue;
      state = applyTriggered(ectx, state, ability, block.do, targetId);
    }
  }
  return state;
}

export type AttackLogInput = { targetId: string; profileId: string; modeId: string; attackIndex: number; result: 'hit' | 'miss' | 'crit'; damage?: number };

export function logAttack(ctx: EvalContext, input: AttackLogInput): State {
  if (!ctx.battle) throw new Error('No battle');
  const battle = appendEvent(ctx.battle, { kind: 'attack', actor: 'self', ...input });
  let state: State = { battle, character: ctx.character };
  const triggers: Trigger[] = input.result === 'miss' ? ['onMiss'] : input.result === 'crit' ? ['onHit', 'onCrit'] : ['onHit'];
  for (const t of triggers) state = runTriggers({ ...ctx, battle: state.battle, character: state.character, ...(input.damage !== undefined ? { lastDamage: input.damage } : {}) }, t, input.targetId);
  return state;
}

export type EnemyLogInput = { actorId: string; result: 'hit' | 'miss' | 'crit'; damage?: number; text?: string };

/** Log an enemy acting on the character (it hit me / missed me), applying damage and onDamaged triggers. */
export function logEnemyAction(ctx: EvalContext, input: EnemyLogInput): State {
  if (!ctx.battle) throw new Error('No battle');
  const battle = appendEvent(ctx.battle, { kind: 'enemy', actor: input.actorId, targetId: 'self', result: input.result, ...(input.damage !== undefined ? { damage: input.damage } : {}), ...(input.text ? { text: input.text } : {}) });
  let state: State = { battle, character: ctx.character };
  if (input.damage) {
    const hp = { ...state.character.hp };
    const t = Math.min(hp.temp, input.damage); hp.temp -= t; hp.current = Math.max(-10, hp.current - (input.damage - t));
    state = { ...state, character: { ...state.character, hp } };
    state = runTriggers({ ...ctx, battle: state.battle, character: state.character, lastDamage: input.damage }, 'onDamaged', input.actorId);
  }
  return state;
}

export type UseAbilityInput = { abilityId: string; targetId?: string };

function payCosts(ctx: EvalContext, state: State, ability: Ability, explicitConsumed: Set<string>): State {
  const vars = exprVars({ ...ctx, ...state });
  for (const c of ability.cost) {
    if (c.kind === 'charge') { if (!explicitConsumed.has(c.resourceId)) state = changeResource(ctx, state, c.resourceId, evalExpr(c.amount, vars)); }
    else if (c.kind === 'hp') { const n = evalExpr(c.amount, vars); state = { ...state, character: { ...state.character, hp: { ...state.character.hp, current: state.character.hp.current - n } } }; }
    else if (c.kind === 'item') {
      const inv = state.character.inventory;
      const idx = inv.findIndex((i) => i.abilityId === c.abilityId && i.quantity > 0);
      if (idx >= 0) state = { ...state, character: { ...state.character, inventory: inv.map((i, j) => (j === idx ? { ...i, quantity: Math.max(0, i.quantity - c.quantity) } : i)) } };
    }
  }
  // Abilities with charge pools but no explicit cost/consume: one use spends one charge of each pool.
  if (!ability.cost.some((c) => c.kind === 'charge')) for (const r of ability.resources) if (!explicitConsumed.has(r.id)) state = changeResource(ctx, state, r.id, 1);
  return state;
}

/** Use an ability: log, pay costs, apply its onUse blocks, start its buff if it has a duration, clear its declare toggle. */
export function useAbility(ctx: EvalContext, input: UseAbilityInput): State {
  if (!ctx.battle) throw new Error('No battle');
  const ability = ctx.library.abilities[input.abilityId] ?? ctx.battle.situational.find((a) => a.id === input.abilityId);
  if (!ability) throw new Error(`Unknown ability "${input.abilityId}"`);
  let state: State = { battle: appendEvent(ctx.battle, { kind: 'use', actor: 'self', abilityId: ability.id, ...(input.targetId ? { targetId: input.targetId } : {}) }), character: ctx.character };
  const vars = exprVars(ctx);

  if (ability.duration && ability.activation !== 'toggle') {
    const rounds = typeof ability.duration === 'object' && 'rounds' in ability.duration ? evalExpr(ability.duration.rounds, vars) : undefined;
    state = { ...state, battle: { ...state.battle, activeBuffs: [...state.battle.activeBuffs, { instanceId: newId('buff'), abilityId: ability.id, owner: 'self', suppressed: false, ...(rounds !== undefined ? { remainingRounds: rounds } : {}) }] } };
  }

  const target = input.targetId ? state.battle.combatants.find((c) => c.id === input.targetId) : undefined;
  const inst = state.character.abilities.find((a) => a.abilityId === ability.id);
  const explicit = new Set<string>();
  for (const block of ability.effects) {
    if (block.trigger !== 'onUse') continue;
    const ectx: EvalContext = { ...ctx, battle: { ...state.battle, toggles: { ...state.battle.toggles, [ability.id]: true } }, character: state.character, target, abilityInstance: inst };
    if (!evalCondition(block.when, ectx)) continue;
    for (const e of block.do) if (e.verb === 'resource' && e.op === 'consume') explicit.add(e.id);
    state = applyTriggered(ectx, state, ability, block.do, input.targetId);
  }
  state = payCosts(ctx, state, ability, explicit);
  if (ability.activation === 'declare' || state.battle.toggles[ability.id] !== undefined) state = { ...state, battle: { ...state.battle, toggles: { ...state.battle.toggles, [ability.id]: false } } };
  return state;
}

/** Switch a toggle ability on or off (Boots of Speed, stances). */
export function setAbilityActive(ctx: EvalContext, abilityId: string, active: boolean): State {
  if (!ctx.battle) throw new Error('No battle');
  const ability = ctx.library.abilities[abilityId];
  if (!ability) throw new Error(`Unknown ability "${abilityId}"`);
  const already = ctx.battle.activeAbilities.includes(abilityId);
  if (already === active) return { battle: ctx.battle, character: ctx.character };
  let state: State = {
    battle: appendEvent({ ...ctx.battle, activeAbilities: active ? [...ctx.battle.activeAbilities, abilityId] : ctx.battle.activeAbilities.filter((x) => x !== abilityId) }, { kind: active ? 'activate' : 'deactivate', actor: 'self', abilityId }),
    character: ctx.character,
  };
  const inst = state.character.abilities.find((a) => a.abilityId === abilityId);
  const explicit = new Set<string>();
  for (const block of ability.effects) {
    if (block.trigger !== (active ? 'onActivate' : 'onDeactivate')) continue;
    const ectx: EvalContext = { ...ctx, ...state, target: ctx.target, abilityInstance: inst };
    if (!evalCondition(block.when, ectx)) continue;
    for (const e of block.do) if (e.verb === 'resource' && e.op === 'consume') explicit.add(e.id);
    state = applyTriggered(ectx, state, ability, block.do, ctx.target?.id);
  }
  if (active) state = payCosts(ctx, state, ability, explicit);
  return state;
}

function expired(c: Conditioned, newRound: number): boolean {
  const from = c.appliedRound ?? newRound;
  const d = c.expires;
  if (!d || d === 'untilRemoved' || d === 'encounter' || d === 'whileActive' || d === 'concentration') return false;
  if (d === 'endOfRound' || d === 'thisTurn' || d === 'thisAttack' || d === 'instant') return newRound > from;
  if (d === 'untilMyNextTurn') return newRound >= from + 2;
  if ('rounds' in d) return newRound >= from + (typeof d.rounds === 'number' ? d.rounds : 1);
  return false;
}

export function nextRound(ctx: EvalContext): State {
  if (!ctx.battle) throw new Error('No battle');
  const round = ctx.battle.round + 1;
  const declareIds = new Set([...Object.values(ctx.library.abilities), ...ctx.battle.situational].filter((a) => a.activation === 'declare').map((a) => a.id));
  let battle: Battle = {
    ...ctx.battle,
    round,
    activeBuffs: ctx.battle.activeBuffs.map((b) => (b.remainingRounds === undefined ? b : { ...b, remainingRounds: b.remainingRounds - 1 })).filter((b) => b.remainingRounds === undefined || b.remainingRounds > 0),
    combatants: ctx.battle.combatants.map((c) => ({ ...c, conditions: c.conditions.filter((x) => !expired(x, round)) })),
    selfConditions: ctx.battle.selfConditions.filter((x) => !expired(x, round)),
    toggles: Object.fromEntries(Object.entries(ctx.battle.toggles).map(([k, v]) => [k, declareIds.has(k) ? false : v])),
    roundResources: {},
  };
  battle = appendEvent(battle, { kind: 'roundStart', actor: 'self' });
  const state = runTriggers({ ...ctx, battle }, 'onRoundStart', ctx.target?.id);
  // Toggle abilities whose charge pool ran dry switch off.
  let out = state.battle;
  for (const id of out.activeAbilities) {
    const a = ctx.library.abilities[id];
    if (!a) continue;
    const pools = a.cost.filter((c) => c.kind === 'charge').map((c) => (c as { resourceId: string }).resourceId);
    const dry = pools.some((rid) => { const r = a.resources.find((x) => x.id === rid); if (!r) return false; return evalExpr(r.max, exprVars({ ...ctx, ...state })) - resourceUsed({ ...ctx, ...state }, rid, r.resetOn) <= 0; });
    if (dry) out = appendEvent({ ...out, activeAbilities: out.activeAbilities.filter((x) => x !== id) }, { kind: 'deactivate', actor: 'self', abilityId: id, text: 'out of charges' });
  }
  return { battle: out, character: state.character };
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
    if (spec.to && spec.value !== undefined) effects.push({ verb: 'modify', to: spec.to, value: spec.value, type: spec.bonusType ?? 'untyped', mode: 'add' });
    if (spec.note) effects.push({ verb: 'note', text: spec.note });
    if (spec.suppressAbilityId && !battle.suppressedAbilities.includes(spec.suppressAbilityId)) battle = { ...battle, suppressedAbilities: [...battle.suppressedAbilities, spec.suppressAbilityId] };
    if (spec.tag) battle = { ...battle, selfConditions: addCondition(battle.selfConditions, { tag: spec.tag, expires: duration, appliedRound: battle.round, source: 'situational' }) };
    if (effects.length) {
      const ability: Ability = { id: newId('sit'), name: spec.label, origin: 'situational', binding: 'none', activation: 'passive', cost: [], resources: [], grants: [], enabledByDefault: true, effects: [{ id: 'e', trigger: 'always', when: { all: [] }, do: effects }] };
      const rounds = typeof duration === 'object' && 'rounds' in duration ? Number(duration.rounds) : undefined;
      battle = { ...battle, situational: [...battle.situational, ability], activeBuffs: [...battle.activeBuffs, { instanceId: newId('buff'), abilityId: ability.id, owner: 'self', suppressed: false, label: spec.label, ...(rounds !== undefined ? { remainingRounds: rounds } : {}) }] };
    }
    return battle;
  }
  const ids = spec.target === 'all' ? battle.combatants.map((c) => c.id) : [spec.target];
  const tag = spec.tag ?? spec.label;
  for (const id of ids) battle = withCombatant(battle, id, (c) => ({ ...c, conditions: addCondition(c.conditions, { tag, expires: duration, appliedRound: battle.round, source: 'situational' }) }));
  return battle;
}

export function setPrompt(ctx: EvalContext, input: { id: string; perTagCategory?: string; value: number; targetId?: string }): Battle {
  if (!ctx.battle) throw new Error('No battle');
  const target = input.targetId ? ctx.battle.combatants.find((c) => c.id === input.targetId) : ctx.target;
  const key = promptKey(ctx, input.id, input.perTagCategory, target);
  if (!key) throw new Error(`Cannot key prompt "${input.id}" by ${input.perTagCategory}: target has no such tag`);
  return { ...ctx.battle, prompts: { ...ctx.battle.prompts, [key]: input.value } };
}

export function setDistance(battle: Battle, combatantId: string, feet: number | undefined): Battle {
  return withCombatant(battle, combatantId, (c) => ({ ...c, distanceFeet: feet }));
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

/** Reset resources that reset on a rest/day. */
export function longRest(character: Character, library?: { abilities: Record<string, Ability> }): Character {
  if (!library) return { ...character, resourceState: {} };
  const keep: Character['resourceState'] = {};
  for (const [id, st] of Object.entries(character.resourceState)) {
    const def = Object.values(library.abilities).flatMap((a) => a.resources).find((r) => r.id === id);
    if (def && (def.resetOn === 'manual' || def.resetOn === 'never')) keep[id] = st;
  }
  return { ...character, resourceState: keep };
}

export type AddCombatantInput = { monster: Monster; name?: string } | { name: string; tags?: string[]; size?: Size };

export function addCombatant(battle: Battle, input: AddCombatantInput): Battle {
  const base = 'monster' in input ? input.name ?? input.monster.name : input.name;
  const taken = new Set(battle.combatants.map((c) => c.name));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  const combatant: Combatant = {
    id: newId('cb'), name, hurt: 'unhurt', conditions: [], dead: false, revealed: false,
    ...('monster' in input ? { monsterId: input.monster.id, tags: [...input.monster.tags], size: input.monster.size } : { tags: input.tags ?? [], size: input.size ?? 'medium' }),
  };
  return { ...battle, combatants: [...battle.combatants, combatant] };
}

export function newBattle(name = 'Battle'): Battle {
  return {
    id: newId('battle'), name, startedAt: new Date().toISOString(), round: 1, combatants: [], activeBuffs: [], situational: [],
    suppressedAbilities: [], activeAbilities: [], selfConditions: [], toggles: {}, tags: [], encounterResources: {}, roundResources: {}, prompts: {}, log: [], ended: false,
  };
}
