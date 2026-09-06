import { SIZE_MOD, abilityMod, promptKey, resourceUsed, type AbilityInstance, type AttackCtx, type EvalContext } from './context';
import { evalCondition } from './conditions';
import { firstFailure, summarizeEffects } from './describe';
import { evalExpr } from './expr';
import { derivedFromLevels } from './levels';
import type { Ability, AttackKind, BonusType, Effect, EffectBlock, StatId } from './schema';
import { stackBonuses, type BonusEntry, type StackedEntry } from './stacking';
import { exprVars } from './vars';

// ---------- result types ----------
export type BreakdownEntry = StackedEntry & { sourceName: string };
export type NearMiss = { source: string; sourceName: string; label: string; summary: string; failed: string };
export type DiceEntry = { dice: string; label: string; damageType?: string };

export type StatResult = {
  stat: StatId;
  total: number;
  entries: BreakdownEntry[];
  dice: DiceEntry[];
  flags: { ignoreConcealment: boolean };
  notes: string[];
  warnings: string[];
  nearMiss: NearMiss[];
};

export type AttackResult = {
  index: number;
  attackBonus: number;
  attackBreakdown: BreakdownEntry[];
  damage: { flat: number; dice: DiceEntry[]; breakdown: BreakdownEntry[] };
  critRange: number;
  critMult: number;
  ignoreConcealment: boolean;
  nearMiss: NearMiss[];
};

export type AttackSequenceResult = {
  profileId: string;
  modeId: string;
  modeLabel: string;
  attacks: AttackResult[];
  notes: string[];
  warnings: string[];
};

export type AttackMode = { modeId: string; label: string; base: 'single' | 'full'; extraAttacksAtTop: number; penalty: number; note?: string; source: string };

export type ActionInfo = {
  abilityId: string;
  name: string;
  activation: Ability['activation'];
  usable: boolean;
  eligible: boolean;
  reasons: string[];
  resources: { id: string; label: string; remaining: number; max: number; per: 'day' | 'encounter' | 'round' }[];
  notes: string[];
};

// ---------- sources ----------
type Source = { ability: Ability; instance: AbilityInstance | undefined; kind: 'ability' | 'buff' | 'situational' };

/** Every ability currently contributing effects for the character. */
export function activeSources(ctx: EvalContext, warnings: string[] = []): Source[] {
  const out: Source[] = [];
  const suppressed = new Set(ctx.battle?.suppressedAbilities ?? []);
  for (const inst of ctx.character.abilities) {
    if (!inst.enabled || suppressed.has(inst.abilityId)) continue;
    const ability = ctx.library.abilities[inst.abilityId];
    if (!ability) { warnings.push(`Unknown ability "${inst.abilityId}" on character; ignored.`); continue; }
    if (ability.source === 'buff' || ability.source === 'condition') continue; // only via activeBuffs
    out.push({ ability, instance: inst, kind: 'ability' });
  }
  for (const buff of ctx.battle?.activeBuffs ?? []) {
    if (buff.owner !== 'self' || buff.suppressed || suppressed.has(buff.abilityId)) continue;
    const ability = ctx.library.abilities[buff.abilityId] ?? ctx.battle?.situational.find((a) => a.id === buff.abilityId);
    if (!ability) { warnings.push(`Unknown buff "${buff.abilityId}"; ignored.`); continue; }
    const instance = ctx.character.abilities.find((a) => a.abilityId === buff.abilityId);
    out.push({ ability, instance, kind: 'buff' });
  }
  return out;
}

type Applied = { source: Source; block: EffectBlock; effect: Effect };

function relevantToStat(e: Effect, stat: StatId | undefined): boolean {
  if (!stat) return true;
  switch (e.kind) {
    case 'bonus': case 'bonusFromTable':
      return e.to === stat || ((stat === 'ac.touch' || stat === 'ac.flatFooted') && e.to === 'ac');
    case 'extraDice': return stat === 'damage';
    case 'ignoreConcealment': case 'attackMode': case 'extraAttack': return stat === 'attack';
    case 'note': return stat === 'attack' || stat === 'damage';
    default: return false;
  }
}

function kindMatches(attackKind: AttackKind | undefined, ctx: EvalContext): boolean {
  return attackKind === undefined || ctx.attack?.kind === attackKind;
}

/** Touch AC ignores armor/shield/natural; flat-footed AC ignores dodge. */
function acVariantAccepts(stat: StatId, bonusType: BonusType): boolean {
  if (stat === 'ac.touch') return !['armor', 'shield', 'natural'].includes(bonusType);
  if (stat === 'ac.flatFooted') return bonusType !== 'dodge';
  return true;
}

/** Walk all 'always' effect blocks; return applied effects plus near-misses relevant to `stat`. */
export function collectEffects(ctx: EvalContext, stat?: StatId, trigger: EffectBlock['trigger'] = 'always') {
  const warnings: string[] = [];
  const applied: Applied[] = [];
  const nearMiss: NearMiss[] = [];
  for (const source of activeSources(ctx, warnings)) {
    const sctx: EvalContext = { ...ctx, abilityInstance: source.instance };
    for (const block of source.ability.effects) {
      if (block.trigger !== trigger) continue;
      const relevant = block.do.filter((e) => relevantToStat(e, stat));
      if (relevant.length === 0) continue;
      if (evalCondition(block.when, sctx)) {
        for (const effect of relevant) applied.push({ source, block, effect });
      } else if (stat && block.when.kind !== 'always') {
        const failed = firstFailure(block.when, sctx) ?? 'condition not met';
        nearMiss.push({
          source: source.ability.id, sourceName: source.ability.name,
          label: block.label ?? source.ability.name, summary: summarizeEffects(block.do), failed,
        });
      }
    }
  }
  return { applied, nearMiss, warnings };
}

function tableValue(table: { upTo?: number; value: number }[], v: number): number {
  for (const row of table) if (row.upTo === undefined || v <= row.upTo) return row.value;
  return table[table.length - 1]!.value;
}

function base(label: string, value: number, bonusType: BonusType = 'untyped'): BonusEntry {
  return { source: 'base', label, value, bonusType };
}

// ---------- base values ----------
function baseEntries(ctx: EvalContext, stat: StatId, warnings: string[]): { entries: BonusEntry[]; dice: DiceEntry[] } {
  const c = ctx.character;
  const s = c.abilityScores;
  const d = derivedFromLevels(c, ctx.library);
  warnings.push(...d.warnings);
  const sizeMod = SIZE_MOD[c.size];
  const dice: DiceEntry[] = [];
  const entries: BonusEntry[] = [];
  const a = ctx.attack;

  switch (stat) {
    case 'attack':
      entries.push(base('Base attack', d.bab));
      if (a) {
        entries.push(base(`${a.profile.attackAbility.toUpperCase()} mod`, abilityMod(s[a.profile.attackAbility])));
        if (a.profile.enhancement) entries.push(base(`${a.profile.name} enhancement`, a.profile.enhancement, 'enhancement'));
      }
      if (sizeMod) entries.push(base('Size', sizeMod, 'size'));
      break;
    case 'damage':
      if (a) {
        dice.push({ dice: a.profile.baseDice, label: a.profile.name });
        if (a.profile.damageAbility) {
          let mod = Math.floor(abilityMod(s[a.profile.damageAbility]) * a.profile.damageAbilityMultiplier);
          if (a.profile.maxDamageAbilityBonus !== undefined) mod = Math.min(mod, a.profile.maxDamageAbilityBonus);
          entries.push(base(`${a.profile.damageAbility.toUpperCase()} mod`, mod));
        }
        if (a.profile.enhancement) entries.push(base(`${a.profile.name} enhancement`, a.profile.enhancement, 'enhancement'));
      }
      break;
    case 'ac': case 'ac.touch': case 'ac.flatFooted':
      entries.push(base('Base', 10));
      if (stat !== 'ac.flatFooted') entries.push(base('DEX mod', abilityMod(s.dex)));
      if (stat !== 'ac.touch') {
        if (c.baseArmor) entries.push(base('Armor', c.baseArmor, 'armor'));
        if (c.baseShield) entries.push(base('Shield', c.baseShield, 'shield'));
        if (c.baseNaturalArmor) entries.push(base('Natural armor', c.baseNaturalArmor, 'natural'));
      }
      if (sizeMod) entries.push(base('Size', sizeMod, 'size'));
      break;
    case 'save.fort': entries.push(base('Base save', d.baseSaves.fort), base('CON mod', abilityMod(s.con))); break;
    case 'save.ref': entries.push(base('Base save', d.baseSaves.ref), base('DEX mod', abilityMod(s.dex))); break;
    case 'save.will': entries.push(base('Base save', d.baseSaves.will), base('WIS mod', abilityMod(s.wis))); break;
    case 'init': entries.push(base('DEX mod', abilityMod(s.dex))); break;
    case 'hp.max': entries.push(base('Max HP', c.hp.max)); break;
    case 'speed': entries.push(base('Base speed', c.speed)); break;
    case 'critRange': entries.push(base('Threat range', a ? 21 - a.profile.critRange : 1)); break;
    case 'critMult': entries.push(base('Multiplier', a ? a.profile.critMult : 2)); break;
    default: {
      if (stat.startsWith('skill.')) {
        const id = stat.slice('skill.'.length);
        const skill = ctx.library.skills[id];
        if (!skill) { warnings.push(`Unknown skill "${id}".`); break; }
        const ranks = c.skills[id]?.ranks ?? 0;
        entries.push(base('Ranks', ranks), base(`${skill.ability.toUpperCase()} mod`, abilityMod(s[skill.ability])));
      }
    }
  }
  return { entries, dice };
}

function statIsAttackLike(stat: StatId) {
  return stat === 'attack' || stat === 'damage' || stat === 'critRange' || stat === 'critMult';
}

// ---------- resolveStat ----------
export function resolveStat(ctx: EvalContext, stat: StatId): StatResult {
  const warnings: string[] = [];
  const { entries, dice } = baseEntries(ctx, stat, warnings);
  const bonuses: BonusEntry[] = [...entries];
  const names: Record<string, string> = { base: 'Base' };
  const notes: string[] = [];
  const flags = { ignoreConcealment: false };
  const vars = exprVars(ctx);

  const col = collectEffects(ctx, stat);
  warnings.push(...col.warnings);
  for (const { source, block, effect } of col.applied) {
    names[source.ability.id] = source.ability.name;
    const label = block.label ?? source.ability.name;
    switch (effect.kind) {
      case 'bonus':
        if (statIsAttackLike(stat) && !kindMatches(effect.attackKind, ctx)) break;
        if (!acVariantAccepts(stat, effect.bonusType)) break;
        bonuses.push({ source: source.ability.id, label, value: evalExpr(effect.value, vars), bonusType: effect.bonusType });
        break;
      case 'bonusFromTable': {
        if (statIsAttackLike(stat) && !kindMatches(effect.attackKind, ctx)) break;
        if (!acVariantAccepts(stat, effect.bonusType)) break;
        const key = promptKey(ctx, effect.promptId, effect.perTagCategory);
        const v = key ? ctx.battle?.prompts[key] : undefined;
        if (v === undefined) {
          warnings.push(`${source.ability.name}: enter "${effect.promptId}" result${effect.perTagCategory ? ` for this ${effect.perTagCategory}` : ''} to apply.`);
          break;
        }
        bonuses.push({ source: source.ability.id, label: `${label} (${v})`, value: tableValue(effect.table, v), bonusType: effect.bonusType });
        break;
      }
      case 'extraDice':
        if (!kindMatches(effect.attackKind, ctx)) break;
        dice.push({ dice: effect.dice, label: effect.label ?? source.ability.name, ...(effect.damageType ? { damageType: effect.damageType } : {}) });
        break;
      case 'ignoreConcealment': flags.ignoreConcealment = true; break;
      case 'note': if (!notes.includes(effect.text)) notes.push(effect.text); break;
      default: break;
    }
  }

  const stacked = stackBonuses(bonuses);
  const result: StatResult = {
    stat,
    total: stacked.total,
    entries: stacked.entries.map((e) => ({ ...e, sourceName: names[e.source] ?? e.source })),
    dice, flags, notes, warnings, nearMiss: col.nearMiss,
  };
  if (stat === 'critRange') result.total = 21 - Math.max(1, Math.min(20, stacked.total));
  return result;
}

// ---------- attack modes ----------
export function listAttackModes(ctx: EvalContext, profileId: string): AttackMode[] {
  const profile = ctx.character.attackProfiles.find((p) => p.id === profileId);
  if (!profile) return [];
  const modes: AttackMode[] = [
    { modeId: 'single', label: 'Single attack', base: 'single', extraAttacksAtTop: 0, penalty: 0, source: 'base' },
    { modeId: 'full', label: 'Full attack', base: 'full', extraAttacksAtTop: 0, penalty: 0, source: 'base' },
  ];
  const actx: EvalContext = { ...ctx, attack: { profile, kind: profile.kind, index: 1, modeId: 'single' } };
  for (const { source, effect } of collectEffects(actx, 'attack').applied) {
    if (effect.kind !== 'attackMode' || !kindMatches(effect.attackKind, actx)) continue;
    modes.push({ modeId: effect.modeId, label: effect.label, base: effect.base, extraAttacksAtTop: effect.extraAttacksAtTop, penalty: effect.penalty, source: source.ability.id, ...(effect.note ? { note: effect.note } : {}) });
  }
  return modes;
}

export type ResolveAttackOptions = { profileId: string; modeId: string; distanceFeet?: number };

export function resolveAttack(ctx: EvalContext, opts: ResolveAttackOptions): AttackSequenceResult {
  const profile = ctx.character.attackProfiles.find((p) => p.id === opts.profileId);
  if (!profile) throw new Error(`Unknown attack profile "${opts.profileId}"`);
  const mode = listAttackModes(ctx, opts.profileId).find((m) => m.modeId === opts.modeId);
  if (!mode) throw new Error(`Attack mode "${opts.modeId}" not available for ${profile.name}`);

  const d = derivedFromLevels(ctx.character, ctx.library);
  const top = d.iterativeAttacks[0] ?? 0;
  const babs = mode.base === 'full' ? [...d.iterativeAttacks] : [top];
  for (let i = 0; i < mode.extraAttacksAtTop; i++) babs.unshift(top);

  const mk = (index: number): AttackCtx => ({ profile, kind: profile.kind, index, modeId: mode.modeId, ...(opts.distanceFeet !== undefined ? { distanceFeet: opts.distanceFeet } : {}) });
  // extra attacks from buffs (haste) evaluated once with attack #1 context
  for (const { effect } of collectEffects({ ...ctx, attack: mk(1) }, 'attack').applied) {
    if (effect.kind === 'extraAttack' && (effect.appliesToBase === 'any' || effect.appliesToBase === mode.base) && kindMatches(effect.attackKind, { ...ctx, attack: mk(1) })) {
      for (let i = 0; i < effect.count; i++) babs.unshift(top);
    }
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  if (mode.note) notes.push(mode.note);
  const attacks: AttackResult[] = babs.map((bab, i) => {
    const actx: EvalContext = { ...ctx, attack: mk(i + 1) };
    const atk = resolveStat(actx, 'attack');
    // swap the generic BAB entry for this attack's iterative value, add mode penalty
    const entries = atk.entries.map((e) => (e.source === 'base' && e.label === 'Base attack' ? { ...e, value: bab, label: i === 0 ? 'Base attack' : `Base attack (iterative)` } : e));
    let attackBonus = atk.total - d.bab + bab;
    if (mode.penalty) {
      entries.push({ source: mode.source, sourceName: mode.label, label: mode.label, value: mode.penalty, bonusType: 'untyped', applied: true });
      attackBonus += mode.penalty;
    }
    const dmg = resolveStat(actx, 'damage');
    const crit = resolveStat(actx, 'critRange');
    const mult = resolveStat(actx, 'critMult');
    for (const n of [...atk.notes, ...dmg.notes]) if (!notes.includes(n)) notes.push(n);
    for (const w of [...atk.warnings, ...dmg.warnings]) if (!warnings.includes(w)) warnings.push(w);
    const nearMiss = [...atk.nearMiss];
    for (const nm of dmg.nearMiss) if (!nearMiss.some((x) => x.source === nm.source && x.label === nm.label)) nearMiss.push(nm);
    return {
      index: i + 1,
      attackBonus,
      attackBreakdown: entries,
      damage: { flat: dmg.total, dice: dmg.dice, breakdown: dmg.entries },
      critRange: crit.total,
      critMult: mult.total,
      ignoreConcealment: atk.flags.ignoreConcealment,
      nearMiss,
    };
  });

  return { profileId: profile.id, modeId: mode.modeId, modeLabel: mode.label, attacks, notes, warnings };
}

// ---------- actions ----------
export function availableActions(ctx: EvalContext): ActionInfo[] {
  const out: ActionInfo[] = [];
  const vars = exprVars(ctx);
  for (const source of activeSources(ctx)) {
    const { ability } = source;
    if (ability.activation === 'passive' && !ability.resources?.length) continue;
    const reasons: string[] = [];
    const resources = (ability.resources ?? []).map((r) => {
      const max = evalExpr(r.max, vars);
      const remaining = max - resourceUsed(ctx, r.id, r.per);
      return { id: r.id, label: r.label ?? ability.name, remaining, max, per: r.per };
    });
    const usable = resources.every((r) => r.remaining > 0);
    if (!usable) reasons.push(`No charges left (${resources.map((r) => `${r.remaining}/${r.max} per ${r.per}`).join(', ')})`);

    // eligibility: pretend this ability is declared, check its effect conditions against current target
    const declared: EvalContext = {
      ...ctx,
      abilityInstance: source.instance,
      ...(ctx.battle ? { battle: { ...ctx.battle, toggles: { ...ctx.battle.toggles, [ability.id]: true } } } : {}),
    };
    let eligible = true;
    const notes: string[] = [];
    const blocks = ability.effects.filter((b) => b.trigger === 'always' || b.trigger === 'onUse');
    if (blocks.length) {
      const passing = blocks.filter((b) => evalCondition(b.when, declared));
      eligible = passing.length > 0;
      if (!eligible) for (const b of blocks) { const f = firstFailure(b.when, declared); if (f) reasons.push(`Needs: ${f}`); }
      for (const b of passing) for (const e of b.do) if (e.kind === 'note') notes.push(e.text);
    }
    out.push({ abilityId: ability.id, name: ability.name, activation: ability.activation, usable, eligible, reasons, resources, notes });
  }
  return out;
}
