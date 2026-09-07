import { z } from 'zod';

// ---------- primitives ----------
export const BonusTypeSchema = z.enum([
  'untyped', 'enhancement', 'insight', 'morale', 'competence', 'circumstance', 'dodge', 'luck',
  'sacred', 'profane', 'racial', 'size', 'deflection', 'natural', 'armor', 'shield', 'resistance',
  'alchemical', 'inherent',
]);
export type BonusType = z.infer<typeof BonusTypeSchema>;

export const SizeSchema = z.enum(['fine', 'diminutive', 'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan', 'colossal']);
export type Size = z.infer<typeof SizeSchema>;

export const HurtSchema = z.enum(['unhurt', 'scratched', 'bloodied', 'nearDeath']);
export type Hurt = z.infer<typeof HurtSchema>;

export const AttackKindSchema = z.enum(['ranged', 'melee']);
export type AttackKind = z.infer<typeof AttackKindSchema>;

export const AbilityKeySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);
export type AbilityKey = z.infer<typeof AbilityKeySchema>;

/** Numeric literal or expression string, see expr.ts */
export const ExprSchema = z.union([z.number(), z.string().min(1)]);
export type Expr = z.infer<typeof ExprSchema>;

/** Stat ids: fixed set plus skill.<id> */
export const StatIdSchema = z.string().regex(
  /^(attack|damage|ac|ac\.touch|ac\.flatFooted|save\.fort|save\.ref|save\.will|init|critRange|critMult|hp\.max|speed|skill\.[A-Za-z0-9_-]+)$/,
  'unknown stat id',
);
export type StatId = z.infer<typeof StatIdSchema>;

export const DurationSchema = z.union([
  z.object({ rounds: z.number().int().positive() }),
  z.literal('untilRemoved'),
  z.literal('endOfNextTurn'),
  z.literal('endOfRound'),
  z.literal('encounter'),
]);
export type Duration = z.infer<typeof DurationSchema>;

// ---------- conditions ----------
const LogScope = z.enum(['thisRound', 'lastRound', 'encounter']);

export type Condition =
  | { kind: 'always' }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition }
  | { kind: 'target.hasTag'; tag: string }
  | { kind: 'target.tagIn'; tags: string[] }
  | { kind: 'target.sizeAtLeast'; size: Size }
  | { kind: 'target.hurtAtMost'; hurt: Hurt }
  | { kind: 'target.hasCondition'; condition: string }
  | { kind: 'self.hasBuff'; abilityId: string }
  | { kind: 'self.hasCondition'; condition: string }
  | { kind: 'self.abilityEnabled'; abilityId: string }
  | { kind: 'attack.kind'; attackKind: AttackKind }
  | { kind: 'attack.withinFeet'; feet: number }
  | { kind: 'attack.isFirstThisRound' }
  | { kind: 'attack.index'; index: number }
  | { kind: 'log'; event: 'hit' | 'miss' | 'crit' | 'use'; target?: 'current' | 'any'; scope: 'thisRound' | 'lastRound' | 'encounter'; abilityId?: string; min?: number }
  | { kind: 'used'; abilityId: string; scope: 'round' | 'encounter' | 'day'; perTagCategory?: string }
  | { kind: 'resource'; id: string; remainingAtLeast: number }
  | { kind: 'toggle'; id: string }
  | { kind: 'prompt'; id: string; atLeast?: number; perTagCategory?: string }
  | { kind: 'round'; atLeast?: number; atMost?: number }
  | { kind: 'param'; name: string; includesTargetTag: true };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('all'), of: z.array(ConditionSchema) }),
    z.object({ kind: z.literal('any'), of: z.array(ConditionSchema) }),
    z.object({ kind: z.literal('not'), of: ConditionSchema }),
    z.object({ kind: z.literal('target.hasTag'), tag: z.string() }),
    z.object({ kind: z.literal('target.tagIn'), tags: z.array(z.string()) }),
    z.object({ kind: z.literal('target.sizeAtLeast'), size: SizeSchema }),
    z.object({ kind: z.literal('target.hurtAtMost'), hurt: HurtSchema }),
    z.object({ kind: z.literal('target.hasCondition'), condition: z.string() }),
    z.object({ kind: z.literal('self.hasBuff'), abilityId: z.string() }),
    z.object({ kind: z.literal('self.hasCondition'), condition: z.string() }),
    z.object({ kind: z.literal('self.abilityEnabled'), abilityId: z.string() }),
    z.object({ kind: z.literal('attack.kind'), attackKind: AttackKindSchema }),
    z.object({ kind: z.literal('attack.withinFeet'), feet: z.number() }),
    z.object({ kind: z.literal('attack.isFirstThisRound') }),
    z.object({ kind: z.literal('attack.index'), index: z.number().int() }),
    z.object({
      kind: z.literal('log'), event: z.enum(['hit', 'miss', 'crit', 'use']),
      target: z.enum(['current', 'any']).optional(), scope: LogScope,
      abilityId: z.string().optional(), min: z.number().int().optional(),
    }),
    z.object({ kind: z.literal('used'), abilityId: z.string(), scope: z.enum(['round', 'encounter', 'day']), perTagCategory: z.string().optional() }),
    z.object({ kind: z.literal('resource'), id: z.string(), remainingAtLeast: z.number().int() }),
    z.object({ kind: z.literal('toggle'), id: z.string() }),
    z.object({ kind: z.literal('prompt'), id: z.string(), atLeast: z.number().optional(), perTagCategory: z.string().optional() }),
    z.object({ kind: z.literal('round'), atLeast: z.number().int().optional(), atMost: z.number().int().optional() }),
    z.object({ kind: z.literal('param'), name: z.string(), includesTargetTag: z.literal(true) }),
  ]),
) as z.ZodType<Condition>;

// ---------- effects ----------
export const EffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bonus'), to: StatIdSchema, value: ExprSchema,
    bonusType: BonusTypeSchema.default('untyped'), attackKind: AttackKindSchema.optional(),
  }),
  z.object({ kind: z.literal('extraDice'), dice: z.string().regex(/^\d+d\d+$/), damageType: z.string().optional(), label: z.string().optional(), attackKind: AttackKindSchema.optional() }),
  z.object({ kind: z.literal('ignoreConcealment') }),
  z.object({ kind: z.literal('applyTag'), to: z.enum(['target', 'self']), tag: z.string(), duration: DurationSchema.default('untilRemoved') }),
  z.object({ kind: z.literal('consume'), resourceId: z.string(), amount: z.number().int().positive().default(1) }),
  z.object({ kind: z.literal('note'), text: z.string() }),
  z.object({
    kind: z.literal('bonusFromTable'), promptId: z.string(), perTagCategory: z.string().optional(),
    table: z.array(z.object({ upTo: z.number().optional(), value: z.number() })).min(1),
    to: StatIdSchema, bonusType: BonusTypeSchema.default('untyped'), attackKind: AttackKindSchema.optional(),
  }),
  z.object({ kind: z.literal('suppress'), abilityId: z.string() }),
  z.object({ kind: z.literal('extraAttack'), appliesToBase: z.enum(['single', 'full', 'any']).default('full'), count: z.number().int().positive().default(1), attackKind: AttackKindSchema.optional() }),
  z.object({ kind: z.literal('revealTarget') }),
  z.object({
    kind: z.literal('attackMode'), modeId: z.string(), label: z.string(),
    base: z.enum(['single', 'full']), extraAttacksAtTop: z.number().int().default(0),
    penalty: z.number().int().default(0), attackKind: AttackKindSchema.optional(), note: z.string().optional(),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const TriggerSchema = z.enum(['always', 'onHit', 'onMiss', 'onCrit', 'onUse', 'onRoundStart']);
export type Trigger = z.infer<typeof TriggerSchema>;

export const EffectBlockSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  trigger: TriggerSchema.default('always'),
  when: ConditionSchema.default({ kind: 'always' }),
  do: z.array(EffectSchema).min(1),
});
export type EffectBlock = z.infer<typeof EffectBlockSchema>;

// ---------- ability ----------
export const ActivationSchema = z.union([
  z.enum(['passive', 'toggle', 'declare']),
  z.object({ action: z.enum(['standard', 'move', 'full', 'swift', 'free', 'immediate']) }),
]);
export type Activation = z.infer<typeof ActivationSchema>;

export const ResourceDefSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  max: ExprSchema,
  per: z.enum(['day', 'encounter', 'round']),
});
export type ResourceDef = z.infer<typeof ResourceDefSchema>;

export const ParamDefSchema = z.object({
  kind: z.literal('tags'),
  label: z.string().optional(),
  category: z.string().optional(),
  count: z.number().int().positive().optional(),
});
export type ParamDef = z.infer<typeof ParamDefSchema>;

export const AbilitySourceSchema = z.enum(['feat', 'item', 'class', 'spell', 'buff', 'memory', 'situational', 'condition', 'core']);

export const AbilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: AbilitySourceSchema,
  text: z.string().optional(),
  sourceRef: z.string().optional(),
  params: z.record(ParamDefSchema).optional(),
  activation: ActivationSchema.default('passive'),
  resources: z.array(ResourceDefSchema).optional(),
  duration: DurationSchema.optional(),
  effects: z.array(EffectBlockSchema).default([]),
  enabledByDefault: z.boolean().default(true),
  todo: z.string().optional(),
});
export type Ability = z.infer<typeof AbilitySchema>;
export type AbilityInput = z.input<typeof AbilitySchema>;

// ---------- library docs ----------
export const TagSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(['creatureType', 'subtype', 'size', 'habitat', 'condition', 'custom']),
  parent: z.string().optional(),
});
export type Tag = z.infer<typeof TagSchema>;

export const LoreEntrySchema = z.object({
  summary: z.string().optional(),
  sections: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
});

export const MonsterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  size: SizeSchema.default('medium'),
  cr: z.union([z.number(), z.string()]).optional(),
  senses: z.string().optional(),
  lore: LoreEntrySchema.optional(),
  notes: z.string().optional(),
  bestiaryId: z.string().optional(),
});
export type Monster = z.infer<typeof MonsterSchema>;

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ability: AbilityKeySchema,
  trainedOnly: z.boolean().default(false),
  armorCheck: z.boolean().default(false),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ClassTableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hitDie: z.number().int().positive(),
  skillPointsPerLevel: z.number().int().nonnegative(),
  classSkills: z.array(z.string()).default([]),
  babProgression: z.enum(['full', '3/4', '1/2']),
  saves: z.object({ fort: z.enum(['good', 'poor']), ref: z.enum(['good', 'poor']), will: z.enum(['good', 'poor']) }),
  levelFeatures: z.record(z.array(z.string())).default({}),
});
export type ClassTable = z.infer<typeof ClassTableSchema>;

export const AttackProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: AttackKindSchema,
  baseDice: z.string().regex(/^\d+d\d+$/),
  enhancement: z.number().int().default(0),
  critRange: z.number().int().min(2).max(20).default(20),
  critMult: z.number().int().min(2).default(2),
  rangeIncrement: z.number().int().optional(),
  attackAbility: AbilityKeySchema,
  damageAbility: AbilityKeySchema.optional(),
  maxDamageAbilityBonus: z.number().int().optional(),
  damageAbilityMultiplier: z.number().default(1),
});
export type AttackProfile = z.infer<typeof AttackProfileSchema>;

export const LevelRecordSchema = z.object({
  level: z.number().int().positive(),
  classId: z.string(),
  /** Hit die result before Con (max die at level 1 per PHB). */
  hpRolled: z.number().int().nonnegative().default(0),
  skillPointsSpent: z.record(z.number().nonnegative()).default({}),
  /** General feat slots spent this level (level 1, 3, 6, 9… plus human bonus). */
  featsTaken: z.array(z.string()).default([]),
  /** Class bonus feats / features granted this level (Track, Rapid Shot, Monster Blow…). */
  featuresGained: z.array(z.string()).default([]),
  /** +1 ability score at levels 4, 8, 12… */
  abilityIncrease: AbilityKeySchema.optional(),
  spellsLearned: z.array(z.string()).default([]),
  notes: z.string().optional(),
  at: z.string().optional(),
});
export type LevelRecord = z.infer<typeof LevelRecordSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abilityScores: z.object({ str: z.number().int(), dex: z.number().int(), con: z.number().int(), int: z.number().int(), wis: z.number().int(), cha: z.number().int() }),
  size: SizeSchema.default('medium'),
  xp: z.number().int().nonnegative().default(0),
  classLevels: z.array(z.object({ classId: z.string(), level: z.number().int().positive() })).default([]),
  hp: z.object({ max: z.number().int(), current: z.number().int(), temp: z.number().int().default(0), nonlethal: z.number().int().default(0) }),
  baseArmor: z.number().int().default(0),
  baseShield: z.number().int().default(0),
  baseNaturalArmor: z.number().int().default(0),
  speed: z.number().int().default(30),
  skills: z.record(z.object({ ranks: z.number().nonnegative(), classSkillOverride: z.boolean().optional() })).default({}),
  attackProfiles: z.array(AttackProfileSchema).default([]),
  abilities: z.array(z.object({ abilityId: z.string(), enabled: z.boolean().default(true), paramValues: z.record(z.array(z.string())).default({}) })).default([]),
  resourceState: z.record(z.object({ used: z.number().int().nonnegative() })).default({}),
  levelHistory: z.array(LevelRecordSchema).default([]),
  /** Racial/other bonus skill points per level (human = 1). */
  extraSkillPointsPerLevel: z.number().int().default(0),
  /** Human bonus feat at level 1. */
  extraFeatAtFirstLevel: z.boolean().default(false),
  /** Flat adjustment to max HP not covered by abilities (e.g. DM ruling). */
  hpAdjust: z.number().int().default(0),
  /** Free-text history: level-ups, HP changes, edits. Newest last. */
  journal: z.array(z.object({ at: z.string(), kind: z.enum(['levelUp', 'hp', 'xp', 'edit', 'rest', 'note']), text: z.string() })).default([]),
  /** Free numeric variables usable in pack expressions, e.g. favoredEnemyBonus1, trophyMultiplier. */
  vars: z.record(z.number()).default({}),
  notes: z.string().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;
export type CharacterInput = z.input<typeof CharacterSchema>;

export const XpTableSchema = z.array(z.object({ level: z.number().int().positive(), xp: z.number().int().nonnegative() }));

export const PackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  description: z.string().optional(),
  tags: z.array(TagSchema).default([]),
  abilities: z.array(AbilitySchema).default([]),
  monsters: z.array(MonsterSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  classTables: z.array(ClassTableSchema).default([]),
  characters: z.array(CharacterSchema).default([]),
  xpTable: XpTableSchema.optional(),
});
export type Pack = z.infer<typeof PackSchema>;

// ---------- battle ----------
export const CombatantSchema = z.object({
  id: z.string().min(1),
  monsterId: z.string().optional(),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  size: SizeSchema.default('medium'),
  hurt: HurtSchema.default('unhurt'),
  conditions: z.array(z.object({ tag: z.string(), expires: DurationSchema.optional(), appliedRound: z.number().int().optional(), source: z.string().optional() })).default([]),
  dead: z.boolean().default(false),
  revealed: z.boolean().default(false),
  notes: z.string().optional(),
});
export type Combatant = z.infer<typeof CombatantSchema>;

export const ActiveBuffSchema = z.object({
  instanceId: z.string().min(1),
  abilityId: z.string().min(1),
  owner: z.string().default('self'),
  remainingRounds: z.number().int().optional(),
  suppressed: z.boolean().default(false),
  label: z.string().optional(),
});
export type ActiveBuff = z.infer<typeof ActiveBuffSchema>;

export const LogEventSchema = z.object({
  id: z.string().min(1),
  round: z.number().int().nonnegative(),
  seq: z.number().int().nonnegative(),
  kind: z.enum(['roundStart', 'attack', 'use', 'tag', 'buff', 'hp', 'note']),
  actor: z.string().default('self'),
  targetId: z.string().optional(),
  profileId: z.string().optional(),
  modeId: z.string().optional(),
  attackIndex: z.number().int().optional(),
  result: z.enum(['hit', 'miss', 'crit']).optional(),
  abilityId: z.string().optional(),
  damage: z.number().int().optional(),
  text: z.string().optional(),
  editedAt: z.string().optional(),
});
export type LogEvent = z.infer<typeof LogEventSchema>;

export const BattleSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Battle'),
  startedAt: z.string(),
  round: z.number().int().positive().default(1),
  combatants: z.array(CombatantSchema).default([]),
  activeBuffs: z.array(ActiveBuffSchema).default([]),
  situational: z.array(AbilitySchema).default([]),
  suppressedAbilities: z.array(z.string()).default([]),
  selfConditions: z.array(z.object({ tag: z.string(), expires: DurationSchema.optional(), appliedRound: z.number().int().optional(), source: z.string().optional() })).default([]),
  toggles: z.record(z.boolean()).default({}),
  encounterResources: z.record(z.number().int().nonnegative()).default({}),
  roundResources: z.record(z.number().int().nonnegative()).default({}),
  prompts: z.record(z.number()).default({}),
  log: z.array(LogEventSchema).default([]),
  ended: z.boolean().default(false),
});
export type Battle = z.infer<typeof BattleSchema>;
