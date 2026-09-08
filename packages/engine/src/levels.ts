import type { Library } from './context';
import { abilityMod } from './context';
import type { Character, ClassTable } from './schema';

export type Derived = {
  level: number;
  bab: number;
  /** Max HP implied by the ledger: Σ rolls + Con mod per level (min 1/level). undefined without a ledger. */
  hpFromLevels: number | undefined;
  hpRolledTotal: number;
  abilityIncreases: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>>;
  /** Level-4/8/12 increases not yet recorded in the ledger. */
  unspentAbilityIncreases: number;
  featSlots: { expected: number; recorded: number };
  /** Points implied by the ranks on the sheet (class 1/rank, cross-class 2/rank) and what is left of the ledger total. */
  skillBudget: { spentByRanks: number; remaining: number; classSkills: string[] };
  isClassSkill: (skillId: string) => boolean;
  iterativeAttacks: number[];
  baseSaves: { fort: number; ref: number; will: number };
  skillPoints: { total: number; spent: number; leftover: number };
  nextLevelXp: number | undefined;
  levelFeatures: string[];
  warnings: string[];
};

function babFor(progression: ClassTable['babProgression'], level: number): number {
  if (progression === 'full') return level;
  if (progression === '3/4') return Math.floor((level * 3) / 4);
  return Math.floor(level / 2);
}

function saveFor(kind: 'good' | 'poor', level: number): number {
  return kind === 'good' ? 2 + Math.floor(level / 2) : Math.floor(level / 3);
}

/** PHB level-dependent benefits: general feat at 1 and every 3rd level; +1 ability score every 4th level. */
export function levelSlots(level: number, opts: { humanBonusFeat: boolean }): { feats: number; abilityIncrease: boolean } {
  let feats = level === 1 || level % 3 === 0 ? 1 : 0;
  if (level === 1 && opts.humanBonusFeat) feats += 1;
  return { feats, abilityIncrease: level % 4 === 0 };
}

/** Max skill ranks: level + 3 for class skills, half that for cross-class. */
export function maxRanks(level: number, classSkill: boolean): number {
  return classSkill ? level + 3 : (level + 3) / 2;
}

export function iterativeAttacks(bab: number): number[] {
  const out = [bab];
  for (let b = bab - 5; b >= 1; b -= 5) out.push(b);
  return out;
}

export function derivedFromLevels(character: Character, library: Library): Derived {
  const warnings: string[] = [];
  let bab = 0;
  const baseSaves = { fort: 0, ref: 0, will: 0 };
  const levelFeatures: string[] = [];
  let level = 0;

  for (const cl of character.classLevels) {
    level += cl.level;
    const table = library.classTables[cl.classId];
    if (!table) {
      warnings.push(`Unknown class "${cl.classId}"; its BAB, saves and features are not counted.`);
      continue;
    }
    bab += babFor(table.babProgression, cl.level);
    baseSaves.fort += saveFor(table.saves.fort, cl.level);
    baseSaves.ref += saveFor(table.saves.ref, cl.level);
    baseSaves.will += saveFor(table.saves.will, cl.level);
    for (let l = 1; l <= cl.level; l++) levelFeatures.push(...(table.levelFeatures[String(l)] ?? []));
  }

  const intMod = abilityMod(character.abilityScores.int);
  const conMod = abilityMod(character.abilityScores.con);
  let total = 0;
  let spent = 0;
  let hpRolledTotal = 0;
  let hpFromLevels = 0;
  const abilityIncreases: Derived['abilityIncreases'] = {};
  const featSlots = { expected: 0, recorded: 0 };
  for (const rec of character.levelHistory) {
    hpRolledTotal += rec.hpRolled;
    hpFromLevels += Math.max(1, rec.hpRolled + conMod);
    if (rec.abilityIncrease) abilityIncreases[rec.abilityIncrease] = (abilityIncreases[rec.abilityIncrease] ?? 0) + 1;
    const slots = levelSlots(rec.level, { humanBonusFeat: character.extraFeatAtFirstLevel });
    featSlots.expected += slots.feats;
    featSlots.recorded += rec.featsTaken.length;
    if (slots.feats > rec.featsTaken.length) warnings.push(`Level ${rec.level}: a general feat slot has no feat recorded.`);
    if (slots.abilityIncrease && !rec.abilityIncrease) warnings.push(`Level ${rec.level}: ability score increase not recorded.`);
    const table = library.classTables[rec.classId];
    if (!table) {
      warnings.push(`Level ${rec.level}: unknown class "${rec.classId}"; skill points not counted.`);
    } else {
      const perLevel = Math.max(1, table.skillPointsPerLevel + intMod) + character.extraSkillPointsPerLevel;
      total += rec.level === 1 ? perLevel * 4 : perLevel;
    }
    for (const n of Object.values(rec.skillPointsSpent)) spent += n;
  }

  const next = library.xpTable.find((row) => row.level === level + 1);
  const classSkills = new Set(character.classLevels.flatMap((cl) => library.classTables[cl.classId]?.classSkills ?? []));
  const isClassSkill = (id: string) => {
    const o = character.skills[id]?.classSkillOverride;
    return o !== undefined ? o : classSkills.has(id);
  };
  let spentByRanks = 0;
  for (const [id, sk] of Object.entries(character.skills)) spentByRanks += sk.ranks * (isClassSkill(id) ? 1 : 2);
  const recordedIncreases = Object.values(abilityIncreases).reduce((a, b) => a + (b ?? 0), 0);
  return {
    unspentAbilityIncreases: Math.max(0, Math.floor(level / 4) - recordedIncreases),
    skillBudget: { spentByRanks, remaining: total - spentByRanks, classSkills: [...classSkills] },
    isClassSkill,
    level,
    bab,
    hpFromLevels: character.levelHistory.length ? hpFromLevels : undefined,
    hpRolledTotal,
    abilityIncreases,
    featSlots,
    iterativeAttacks: iterativeAttacks(bab),
    baseSaves,
    skillPoints: { total, spent, leftover: total - spent },
    nextLevelXp: next?.xp,
    levelFeatures,
    warnings,
  };
}
