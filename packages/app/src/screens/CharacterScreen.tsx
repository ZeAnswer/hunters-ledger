import { useMemo, useState } from 'react';
import { applyHp, availableActions, derivedFromLevels, longRest, resolveStat, type StatId } from '@hl/engine';
import { useStore } from '../store/store';
import { useCtx } from '../store/hooks';
import { Button, Field, Section, Sheet, cx, inputCls, signed } from '../components/ui';
import { Breakdown } from '../components/battle/AttackPanel';

export function CharacterScreen() {
  const ctx = useCtx();
  const setCharacter = useStore((s) => s.setCharacter);
  const battle = useStore((s) => s.battle);
  const setBattle = useStore((s) => s.setBattle);
  const showToast = useStore((s) => s.showToast);
  const [hpOp, setHpOp] = useState<'damage' | 'heal' | 'temp' | 'nonlethal' | undefined>();
  const [amount, setAmount] = useState('');
  const [stat, setStat] = useState<StatId | undefined>();
  const derived = useMemo(() => (ctx ? derivedFromLevels(ctx.character, ctx.library) : undefined), [ctx]);
  const actions = useMemo(() => (ctx ? availableActions(ctx) : []), [ctx]);
  if (!ctx || !derived) return <div className="p-4 text-zinc-500">No character.</div>;
  const c = ctx.character;
  const stats: { id: StatId; label: string }[] = [
    { id: 'ac', label: 'AC' }, { id: 'ac.touch', label: 'Touch' }, { id: 'ac.flatFooted', label: 'Flat-footed' },
    { id: 'save.fort', label: 'Fort' }, { id: 'save.ref', label: 'Ref' }, { id: 'save.will', label: 'Will' }, { id: 'init', label: 'Init' }, { id: 'speed', label: 'Speed' },
  ];
  const doHp = () => {
    const n = Number(amount); if (!n || !hpOp) return;
    const next = applyHp(c, { [hpOp]: n });
    setCharacter(next);
    if (battle) setBattle({ ...battle, log: [...battle.log, { id: `hp-${Date.now()}`, round: battle.round, seq: (battle.log.at(-1)?.seq ?? 0) + 1, kind: 'hp', actor: 'self', text: `${hpOp} ${n} → HP ${next.hp.current}/${next.hp.max}` }] });
    setHpOp(undefined); setAmount('');
  };
  const mod = (v: number) => Math.floor((v - 10) / 2);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{c.name}</h1>
      <div className="mb-4 text-sm text-zinc-400">{c.classLevels.map((l) => `${ctx.library.classTables[l.classId]?.name ?? l.classId} ${l.level}`).join(' / ')} · level {derived.level} · XP {c.xp}{derived.nextLevelXp ? ` / ${derived.nextLevelXp}` : ''}</div>

      <Section title="Hit points">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
          <div className="flex items-end gap-3">
            <span className={cx('text-4xl font-bold tabular-nums', c.hp.current <= 0 ? 'text-red-400' : c.hp.current * 2 <= c.hp.max ? 'text-amber-300' : 'text-emerald-300')}>{c.hp.current}</span>
            <span className="text-zinc-400 mb-1">/ {c.hp.max}</span>
            {c.hp.temp > 0 && <span className="mb-1 rounded bg-sky-900 px-2 text-sky-200">+{c.hp.temp} temp</span>}
            {c.hp.nonlethal > 0 && <span className="mb-1 rounded bg-zinc-800 px-2 text-zinc-300">{c.hp.nonlethal} nonlethal</span>}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button variant="danger" onClick={() => setHpOp('damage')}>Damage</Button>
            <Button variant="success" onClick={() => setHpOp('heal')}>Heal</Button>
            <Button onClick={() => setHpOp('temp')}>Temp</Button>
            <Button onClick={() => setHpOp('nonlethal')}>Nonlethal</Button>
          </div>
        </div>
      </Section>

      <Section title="Stats">
        <div className="grid grid-cols-6 gap-1 mb-2 text-center">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => <div key={k} className="rounded-xl bg-zinc-900 py-1"><div className="text-[10px] uppercase text-zinc-500">{k}</div><div className="font-bold">{c.abilityScores[k]}</div><div className="text-xs text-zinc-400">{signed(mod(c.abilityScores[k]))}</div></div>)}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => { const r = resolveStat(ctx, s.id); return <button key={s.id} type="button" onClick={() => setStat(s.id)} className="rounded-xl border border-zinc-700 bg-zinc-900 py-2 text-center active:bg-zinc-800"><div className="text-[10px] uppercase text-zinc-500">{s.label}</div><div className="text-xl font-bold tabular-nums">{s.id === 'speed' ? r.total : s.id.startsWith('ac') ? r.total : signed(r.total)}</div></button>; })}
          <div className="rounded-xl border border-zinc-800 py-2 text-center"><div className="text-[10px] uppercase text-zinc-500">BAB</div><div className="text-xl font-bold">{signed(derived.bab)}</div></div>
        </div>
        {ctx.target && <p className="mt-2 text-xs text-zinc-500">Conditional bonuses shown vs current target: {ctx.target.name}.</p>}
      </Section>

      <Section title="Skills">
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {Object.values(ctx.library.skills).filter((s) => (c.skills[s.id]?.ranks ?? 0) > 0 || !s.trainedOnly).sort((a, b) => a.name.localeCompare(b.name)).map((s) => { const r = resolveStat(ctx, `skill.${s.id}`); const ranks = c.skills[s.id]?.ranks ?? 0; return (
            <button key={s.id} type="button" onClick={() => setStat(`skill.${s.id}`)} className={cx('flex w-full items-center justify-between px-3 py-1.5 text-left text-sm', ranks === 0 && 'text-zinc-500')}><span>{s.name}<span className="ml-2 text-xs text-zinc-500">{ranks} ranks</span></span><span className="font-semibold tabular-nums">{signed(r.total)}</span></button>
          ); })}
        </div>
      </Section>

      <Section title="Abilities & items" right={<Button size="sm" variant="ghost" onClick={() => { setCharacter(longRest(c)); showToast('Daily charges reset'); }}>Long rest</Button>}>
        <div className="space-y-1">
          {c.abilities.map((inst) => { const a = ctx.library.abilities[inst.abilityId]; if (!a) return null; const act = actions.find((x) => x.abilityId === a.id); return (
            <div key={inst.abilityId} className={cx('flex items-center justify-between gap-2 rounded-xl px-3 py-2', inst.enabled ? 'bg-zinc-900' : 'bg-zinc-950 text-zinc-500')}>
              <div className="min-w-0">
                <div className="truncate">{a.name}{a.todo ? <span className="ml-1 text-amber-400" title={a.todo}>⚑</span> : null}</div>
                <div className="text-xs text-zinc-500">{a.source}{act?.resources.map((r) => ` · ${r.label} ${r.remaining}/${r.max}`)}{Object.entries(inst.paramValues).map(([k, v]) => ` · ${k}: ${v.map((t) => ctx.library.tags[t]?.label ?? t).join(', ')}`)}</div>
              </div>
              <input type="checkbox" className="h-5 w-5" checked={inst.enabled} onChange={(e) => setCharacter({ ...c, abilities: c.abilities.map((x) => (x.abilityId === inst.abilityId ? { ...x, enabled: e.target.checked } : x)) })} />
            </div>
          ); })}
        </div>
      </Section>

      {c.notes && <Section title="Notes"><pre className="whitespace-pre-wrap rounded-xl bg-zinc-900 p-3 text-xs text-zinc-300">{c.notes}</pre></Section>}

      <Sheet open={!!hpOp} onClose={() => setHpOp(undefined)} title={hpOp ? hpOp[0]!.toUpperCase() + hpOp.slice(1) : ''}>
        <Field label="Amount" htmlFor="hp-amount"><input id="hp-amount" autoFocus className={inputCls + ' text-3xl'} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doHp()} /></Field>
        <Button variant="primary" size="lg" className="w-full" onClick={doHp}>Apply</Button>
      </Sheet>

      <Sheet open={!!stat} onClose={() => setStat(undefined)} title={stat}>
        {stat && (() => { const r = resolveStat(ctx, stat); return (
          <div className="text-sm">
            <div className="mb-3 text-3xl font-bold">{signed(r.total)}</div>
            <Breakdown title="Breakdown" entries={r.entries} />
            {r.nearMiss.length > 0 && <div className="mt-3"><div className="mb-1 text-xs uppercase text-zinc-500">Not applying</div>{r.nearMiss.map((n) => <div key={n.source + n.label} className="text-zinc-500">{n.label} ({n.summary}) — needs {n.failed}</div>)}</div>}
            {r.warnings.map((w) => <div key={w} className="mt-2 text-amber-300">{w}</div>)}
          </div>
        ); })()}
      </Sheet>
    </div>
  );
}
