import type { BonusType } from './schema';

export type BonusEntry = {
  value: number;
  bonusType: BonusType;
  /** ability id or 'base' */
  source: string;
  label: string;
};

export type StackedEntry = BonusEntry & { applied: boolean; reason?: string };

export type StackResult = { total: number; entries: StackedEntry[] };

/** Bonus types that stack with themselves per 3.5e rules. */
const SELF_STACKING: ReadonlySet<BonusType> = new Set(['untyped', 'dodge', 'circumstance']);

/**
 * 3.5e stacking: bonuses of the same named type do not stack (highest wins);
 * untyped, dodge and circumstance stack; penalties always stack.
 */
export function stackBonuses(bonuses: readonly BonusEntry[]): StackResult {
  const bestByType = new Map<BonusType, number>();
  for (const b of bonuses) {
    if (b.value <= 0 || SELF_STACKING.has(b.bonusType)) continue;
    const cur = bestByType.get(b.bonusType);
    if (cur === undefined || b.value > cur) bestByType.set(b.bonusType, b.value);
  }
  const consumed = new Set<BonusType>();
  let total = 0;
  const entries: StackedEntry[] = bonuses.map((b) => {
    if (b.value <= 0 || SELF_STACKING.has(b.bonusType)) {
      total += b.value;
      return { ...b, applied: true };
    }
    const best = bestByType.get(b.bonusType);
    if (b.value === best && !consumed.has(b.bonusType)) {
      consumed.add(b.bonusType);
      total += b.value;
      return { ...b, applied: true };
    }
    return { ...b, applied: false, reason: `${b.bonusType} bonus does not stack; +${best} already applied` };
  });
  return { total, entries };
}
