import type { Library } from './context';
import { abilityMod } from './context';
import type { Character, ClassTable } from './schema';

export type Derived = {
  level: number;
  bab: number;
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
  let total = 0;
  let spent = 0;
  for (const rec of character.levelHistory) {
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
  return {
    level,
    bab,
    iterativeAttacks: iterativeAttacks(bab),
    baseSaves,
    skillPoints: { total, spent, leftover: total - spent },
    nextLevelXp: next?.xp,
    levelFeatures,
    warnings,
  };
}
