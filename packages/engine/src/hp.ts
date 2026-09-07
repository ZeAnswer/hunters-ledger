import type { Character } from './schema';

export type HpOp = { damage?: number; heal?: number; temp?: number; nonlethal?: number; healNonlethal?: number; setMax?: number; setCurrent?: number };

export function applyHp(character: Character, op: HpOp, maxOverride?: number): Character {
  let { max, current, temp, nonlethal } = character.hp;
  if (maxOverride !== undefined) max = maxOverride;
  if (op.setMax !== undefined) { current += op.setMax - max; max = op.setMax; }
  if (op.setCurrent !== undefined) current = op.setCurrent;
  if (op.damage) {
    const fromTemp = Math.min(temp, op.damage);
    temp -= fromTemp;
    current -= op.damage - fromTemp;
  }
  if (op.heal) current = Math.min(max, current + op.heal);
  if (op.temp !== undefined) temp = Math.max(temp, op.temp);
  if (op.nonlethal) nonlethal += op.nonlethal;
  if (op.healNonlethal) nonlethal = Math.max(0, nonlethal - op.healNonlethal);
  // SRD: dead at -10 or lower; clamp there so the display stays meaningful.
  current = Math.max(-10, current);
  return { ...character, hp: { max, current, temp, nonlethal } };
}
