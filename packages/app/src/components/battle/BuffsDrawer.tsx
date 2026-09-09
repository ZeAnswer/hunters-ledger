import { useState } from 'react';
import { newId, type EvalContext } from '@hl/engine';
import { useStore } from '../../store/store';
import { Button, Chip, Field, Sheet, Stepper, humanize, inputCls } from '../ui';

export function BuffsDrawer({ ctx, open, onClose }: { ctx: EvalContext; open: boolean; onClose: () => void }) {
  const setBattle = useStore((s) => s.setBattle);
  const battle = ctx.battle!;
  const [q, setQ] = useState('');
  const lib = ctx.library;
  const candidates = Object.values(lib.abilities).filter((a) => (a.origin === 'buff' || a.origin === 'condition' || a.origin === 'situational') && (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const nameOf = (id: string) => lib.abilities[id]?.name ?? battle.situational.find((s) => s.id === id)?.name ?? id;

  const add = (abilityId: string) => {
    const a = lib.abilities[abilityId]!;
    const rounds = typeof a.duration === 'object' && 'rounds' in a.duration && typeof a.duration.rounds === 'number' ? a.duration.rounds : undefined;
    setBattle({ ...battle, activeBuffs: [...battle.activeBuffs, { instanceId: newId('buff'), abilityId, owner: 'self', suppressed: false, ...(rounds !== undefined ? { remainingRounds: rounds } : {}) }] });
  };
  const patch = (instanceId: string, p: Partial<(typeof battle.activeBuffs)[number]>) => setBattle({ ...battle, activeBuffs: battle.activeBuffs.map((b) => (b.instanceId === instanceId ? { ...b, ...p } : b)) });
  const remove = (instanceId: string) => setBattle({ ...battle, activeBuffs: battle.activeBuffs.filter((b) => b.instanceId !== instanceId) });

  const instances = ctx.character.abilities.filter((i) => i.enabled).map((i) => lib.abilities[i.abilityId]).filter(Boolean);

  return (
    <Sheet open={open} onClose={onClose} title="Buffs, conditions, suppression" tall>
      <Field label="Active on you">
        {battle.activeBuffs.length === 0 && <div className="text-sm text-zinc-500">Nothing active.</div>}
        <div className="space-y-2">
          {battle.activeBuffs.map((b) => (
            <div key={b.instanceId} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2">
              <div className="min-w-0">
                <div className={b.suppressed ? 'line-through text-zinc-500' : 'font-medium'}>{b.label ?? nameOf(b.abilityId)}</div>
                {b.remainingRounds !== undefined && <div className="flex items-center gap-2 text-xs text-zinc-400">rounds left <Stepper value={b.remainingRounds} onChange={(v) => patch(b.instanceId, { remainingRounds: v })} /></div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => patch(b.instanceId, { suppressed: !b.suppressed })}>{b.suppressed ? 'Resume' : 'Suppress'}</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(b.instanceId)}>✕</Button>
              </div>
            </div>
          ))}
        </div>
      </Field>
      {battle.selfConditions.length > 0 && (
        <Field label="Your conditions">
          <div className="flex flex-wrap gap-2">{battle.selfConditions.map((c) => <Chip key={c.tag} tone="blue" active onClick={() => setBattle({ ...battle, selfConditions: battle.selfConditions.filter((x) => x.tag !== c.tag) })}>{lib.tags[c.tag]?.label ?? humanize(c.tag)} ✕</Chip>)}</div>
        </Field>
      )}
      <Field label="Add buff / condition">
        <input className={inputCls} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">{candidates.map((a) => <Chip key={a.id} tone={a.origin === 'condition' ? 'red' : 'green'} onClick={() => add(a.id)}>+ {a.name}</Chip>)}</div>
      </Field>
      <Field label="Suppress abilities (anti-magic, disarmed…)">
        <div className="flex flex-wrap gap-2">
          {instances.map((a) => <Chip key={a!.id} tone="red" active={battle.suppressedAbilities.includes(a!.id)} onClick={() => setBattle({ ...battle, suppressedAbilities: battle.suppressedAbilities.includes(a!.id) ? battle.suppressedAbilities.filter((x) => x !== a!.id) : [...battle.suppressedAbilities, a!.id] })}>{a!.name}</Chip>)}
        </div>
      </Field>
    </Sheet>
  );
}
