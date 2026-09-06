import type { BonusType, Duration, Effect, StatId } from '@hl/engine';
import { useStore } from '../../store/store';
import { Chip, inputCls } from '../ui';

type Kind = Effect['kind'];
const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'bonus', label: 'Bonus / penalty' }, { kind: 'extraDice', label: 'Extra damage dice' }, { kind: 'bonusFromTable', label: 'Bonus from a check (table)' },
  { kind: 'note', label: 'Reminder note' }, { kind: 'applyTag', label: 'Apply condition/tag' }, { kind: 'consume', label: 'Spend charges' },
  { kind: 'attackMode', label: 'New attack mode' }, { kind: 'extraAttack', label: 'Extra attack (haste-like)' }, { kind: 'ignoreConcealment', label: 'Ignore concealment' },
  { kind: 'suppress', label: 'Suppress an ability' }, { kind: 'revealTarget', label: 'Reveal target lore' },
];
const STATS: StatId[] = ['attack', 'damage', 'ac', 'save.fort', 'save.ref', 'save.will', 'init', 'critRange', 'critMult', 'speed', 'hp.max'];
const TYPES: BonusType[] = ['untyped', 'enhancement', 'insight', 'morale', 'competence', 'circumstance', 'dodge', 'luck', 'sacred', 'profane', 'racial', 'size', 'deflection', 'natural', 'armor', 'shield', 'resistance', 'alchemical', 'inherent'];

function defaultFor(kind: Kind): Effect {
  switch (kind) {
    case 'bonus': return { kind, to: 'attack', value: 1, bonusType: 'untyped' };
    case 'extraDice': return { kind, dice: '1d6' };
    case 'bonusFromTable': return { kind, promptId: 'knowledge', perTagCategory: 'creatureType', to: 'attack', bonusType: 'insight', table: [{ upTo: 15, value: 1 }, { upTo: 25, value: 2 }, { value: 3 }] };
    case 'note': return { kind, text: '' };
    case 'applyTag': return { kind, to: 'target', tag: 'flanked', duration: 'endOfNextTurn' };
    case 'consume': return { kind, resourceId: '', amount: 1 };
    case 'attackMode': return { kind, modeId: 'new-mode', label: 'New mode', base: 'full', extraAttacksAtTop: 1, penalty: -2 };
    case 'extraAttack': return { kind, appliesToBase: 'full', count: 1 };
    case 'ignoreConcealment': return { kind };
    case 'suppress': return { kind, abilityId: '' };
    case 'revealTarget': return { kind };
  }
}

export function EffectEditor({ value, onChange, onRemove }: { value: Effect; onChange: (e: Effect) => void; onRemove: () => void }) {
  const tags = useStore((s) => s.library.tags);
  const skills = useStore((s) => s.library.skills);
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch } as Effect);
  const statSelect = (current: string) => (
    <select className={inputCls} value={current} onChange={(e) => set({ to: e.target.value })}>
      {STATS.map((s) => <option key={s} value={s}>{s}</option>)}
      <optgroup label="Skills">{Object.values(skills).sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={`skill.${s.id}`}>{s.name}</option>)}</optgroup>
    </select>
  );
  const typeChips = (current: BonusType) => <div className="flex flex-wrap gap-1">{TYPES.map((t) => <Chip key={t} active={current === t} onClick={() => set({ bonusType: t })}>{t}</Chip>)}</div>;
  const kindChips = (current: 'ranged' | 'melee' | undefined) => (
    <div className="flex gap-1 text-xs"><span className="self-center text-zinc-500">only for</span>{(['any', 'ranged', 'melee'] as const).map((k) => <Chip key={k} active={(current ?? 'any') === k} onClick={() => set({ attackKind: k === 'any' ? undefined : k })}>{k}</Chip>)}</div>
  );

  let body: React.ReactNode = null;
  switch (value.kind) {
    case 'bonus': body = (
      <div className="space-y-1">
        <div className="flex gap-2">{statSelect(value.to)}<input className={inputCls + ' w-28'} placeholder="value or expr" value={String(value.value)} onChange={(e) => set({ value: /^-?\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value })} /></div>
        {typeChips(value.bonusType)}
        {kindChips(value.attackKind)}
        <div className="text-[11px] text-zinc-500">Expressions: wisMod, strMod, level, bab, classLevel(ranger), prompt(knowledge), floor/min/max, + - * /, plus character vars like trophyMultiplier.</div>
      </div>
    ); break;
    case 'extraDice': body = (
      <div className="space-y-1">
        <div className="flex gap-2"><input className={inputCls + ' w-24'} value={value.dice} onChange={(e) => set({ dice: e.target.value })} /><input className={inputCls} placeholder="label" value={value.label ?? ''} onChange={(e) => set({ label: e.target.value || undefined })} /><input className={inputCls + ' w-28'} placeholder="type (fire…)" value={value.damageType ?? ''} onChange={(e) => set({ damageType: e.target.value || undefined })} /></div>
        {kindChips(value.attackKind)}
      </div>
    ); break;
    case 'bonusFromTable': body = (
      <div className="space-y-1">
        <div className="flex gap-2"><input className={inputCls} placeholder="prompt id" value={value.promptId} onChange={(e) => set({ promptId: e.target.value })} /><input className={inputCls} placeholder="per tag category" value={value.perTagCategory ?? ''} onChange={(e) => set({ perTagCategory: e.target.value || undefined })} /></div>
        {statSelect(value.to)}
        {typeChips(value.bonusType)}
        <div className="text-xs text-zinc-400">Table (check result up to → bonus; last row = anything higher)</div>
        {value.table.map((row, i) => (
          <div key={i} className="flex items-center gap-2"><input className={inputCls + ' w-24'} inputMode="numeric" placeholder="∞" value={row.upTo ?? ''} onChange={(e) => set({ table: value.table.map((r, j) => (j === i ? { ...r, upTo: e.target.value === '' ? undefined : Number(e.target.value) } : r)) })} /><span>→</span><input className={inputCls + ' w-20'} inputMode="numeric" value={row.value} onChange={(e) => set({ table: value.table.map((r, j) => (j === i ? { ...r, value: Number(e.target.value) } : r)) })} /><button type="button" className="text-zinc-500" onClick={() => set({ table: value.table.filter((_, j) => j !== i) })}>✕</button></div>
        ))}
        <button type="button" className="text-sm text-amber-300" onClick={() => set({ table: [...value.table, { value: 0 }] })}>+ row</button>
      </div>
    ); break;
    case 'note': body = <textarea className={inputCls} value={value.text} onChange={(e) => set({ text: e.target.value })} placeholder="Shown during battle when this applies" />; break;
    case 'applyTag': body = (
      <div className="space-y-1">
        <div className="flex gap-1">{(['target', 'self'] as const).map((t) => <Chip key={t} active={value.to === t} onClick={() => set({ to: t })}>{t === 'self' ? 'me' : 'target'}</Chip>)}</div>
        <select className={inputCls} value={value.tag} onChange={(e) => set({ tag: e.target.value })}>{Object.values(tags).filter((t) => t.category === 'condition' || t.category === 'custom').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <DurationPicker value={value.duration} onChange={(d) => set({ duration: d })} />
      </div>
    ); break;
    case 'consume': body = <div className="flex gap-2"><input className={inputCls} placeholder="resource id" value={value.resourceId} onChange={(e) => set({ resourceId: e.target.value })} /><input className={inputCls + ' w-20'} inputMode="numeric" value={value.amount} onChange={(e) => set({ amount: Number(e.target.value) || 1 })} /></div>; break;
    case 'attackMode': body = (
      <div className="space-y-1">
        <div className="flex gap-2"><input className={inputCls} placeholder="mode id" value={value.modeId} onChange={(e) => set({ modeId: e.target.value })} /><input className={inputCls} placeholder="label" value={value.label} onChange={(e) => set({ label: e.target.value })} /></div>
        <div className="flex gap-1">{(['single', 'full'] as const).map((b) => <Chip key={b} active={value.base === b} onClick={() => set({ base: b })}>based on {b}</Chip>)}</div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">extra attacks at top <input className={inputCls + ' w-16'} inputMode="numeric" value={value.extraAttacksAtTop} onChange={(e) => set({ extraAttacksAtTop: Number(e.target.value) || 0 })} /> penalty on all <input className={inputCls + ' w-16'} inputMode="numeric" value={value.penalty} onChange={(e) => set({ penalty: Number(e.target.value) || 0 })} /></div>
        {kindChips(value.attackKind)}
        <input className={inputCls} placeholder="note shown when using this mode" value={value.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} />
      </div>
    ); break;
    case 'extraAttack': body = <div className="flex items-center gap-2 text-xs text-zinc-400">{(['full', 'single', 'any'] as const).map((b) => <Chip key={b} active={value.appliesToBase === b} onClick={() => set({ appliesToBase: b })}>{b} modes</Chip>)} count <input className={inputCls + ' w-16'} inputMode="numeric" value={value.count} onChange={(e) => set({ count: Number(e.target.value) || 1 })} /></div>; break;
    case 'suppress': body = <input className={inputCls} placeholder="ability id" value={value.abilityId} onChange={(e) => set({ abilityId: e.target.value })} />; break;
    default: body = null;
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
      <div className="mb-1 flex items-center gap-2">
        <select className={inputCls + ' flex-1 py-1.5 text-sm'} value={value.kind} onChange={(e) => onChange(defaultFor(e.target.value as Kind))}>{KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select>
        <button type="button" className="px-2 text-zinc-500" onClick={onRemove}>✕</button>
      </div>
      {body}
    </div>
  );
}

export function DurationPicker({ value, onChange }: { value: Duration; onChange: (d: Duration) => void }) {
  const kind = typeof value === 'object' ? 'rounds' : value;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {([['endOfRound', 'this round'], ['endOfNextTurn', 'until my next turn ends'], ['encounter', 'whole battle'], ['untilRemoved', 'until removed'], ['rounds', 'N rounds']] as const).map(([k, l]) => (
        <Chip key={k} active={kind === k} onClick={() => onChange(k === 'rounds' ? { rounds: 3 } : k)}>{l}</Chip>
      ))}
      {typeof value === 'object' && <input className={inputCls + ' w-16'} inputMode="numeric" value={value.rounds} onChange={(e) => onChange({ rounds: Math.max(1, Number(e.target.value) || 1) })} />}
    </div>
  );
}
