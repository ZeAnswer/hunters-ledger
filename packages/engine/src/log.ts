import type { Battle, LogEvent } from './schema';

export type LogQuery = {
  event: 'hit' | 'miss' | 'crit' | 'use';
  scope: 'thisRound' | 'lastRound' | 'encounter';
  targetId?: string;
  abilityId?: string;
  actor?: string;
};

function inScope(e: LogEvent, battle: Battle, scope: LogQuery['scope']): boolean {
  if (scope === 'thisRound') return e.round === battle.round;
  if (scope === 'lastRound') return e.round === battle.round - 1;
  return true;
}

function matchesEvent(e: LogEvent, q: LogQuery): boolean {
  switch (q.event) {
    case 'hit': return e.kind === 'attack' && (e.result === 'hit' || e.result === 'crit');
    case 'crit': return e.kind === 'attack' && e.result === 'crit';
    case 'miss': return e.kind === 'attack' && e.result === 'miss';
    case 'use': return e.kind === 'use' && (q.abilityId === undefined || e.abilityId === q.abilityId);
  }
}

export function findLogEvents(battle: Battle, q: LogQuery): LogEvent[] {
  return battle.log.filter(
    (e) =>
      inScope(e, battle, q.scope) &&
      matchesEvent(e, q) &&
      (q.targetId === undefined || e.targetId === q.targetId) &&
      (q.actor === undefined || e.actor === q.actor),
  );
}

export function countLogEvents(battle: Battle, q: LogQuery): number {
  return findLogEvents(battle, q).length;
}

export function isFirstAttackThisRound(battle: Battle, actor = 'self'): boolean {
  return !battle.log.some((e) => e.kind === 'attack' && e.round === battle.round && e.actor === actor);
}
