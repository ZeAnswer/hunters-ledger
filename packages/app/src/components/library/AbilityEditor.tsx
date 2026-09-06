import { useState } from 'react';
import { AbilitySchema, type Ability, type EffectBlock, type Trigger } from '@hl/engine';
import { Button, Chip, Field, cx, inputCls } from '../ui';
import { ConditionEditor } from './ConditionEditor';
import { DurationPicker, EffectEditor } from './EffectEditor';

const SOURCES = ['feat', 'class', 'item', 'memory', 'buff', 'condition', 'spell', 'situational', 'core'] as const;
const TRIGGERS: { id: Trigger; label: string }[] = [
  { id: 'always', label: 'While conditions hold (passive)' }, { id: 'onHit', label: 'When I hit' }, { id: 'onMiss', label: 'When I miss' }, { id: 'onCrit', label: 'When I crit' }, { id: 'onUse', label: 'When I use this ability' }, { id: 'onRoundStart', label: 'At round start' },
];

export function AbilityEditor({ initial, onSave, onDelete, onCancel }: { initial: Ability; onSave: (a: Ability) => void; onDelete?: () => void; onCancel: () => void }) {
  const [a, setA] = useState<Ability>(initial);
  const [tab, setTab] = useState<'builder' | 'json'>('builder');
  const [json, setJson] = useState(() => JSON.stringify(initial, null, 2));
  const [err, setErr] = useState<string | undefined>();
  const set = (patch: Partial<Ability>) => setA({ ...a, ...patch });
  const setBlock = (i: number, patch: Partial<EffectBlock>) => set({ effects: a.effects.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const switchTab = (t: 'builder' | 'json') => {
    if (t === 'json') setJson(JSON.stringify(a, null, 2));
    else { try { setA(AbilitySchema.parse(JSON.parse(json))); setErr(undefined); } catch (e) { setErr((e as Error).message); return; } }
    setTab(t);
  };
  const save = () => {
    try {
      const parsed = AbilitySchema.parse(tab === 'json' ? JSON.parse(json) : a);
      if (!parsed.id.trim()) throw new Error('id required');
      onSave(parsed);
    } catch (e) { setErr((e as Error).message); }
  };
  const actKind = a.activation === 'passive' || a.activation === 'toggle' || a.activation === 'declare' ? a.activation : 'action';

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-zinc-900 p-1">{(['builder', 'json'] as const).map((t) => <button key={t} type="button" onClick={() => switchTab(t)} className={cx('flex-1 rounded-lg py-1.5 text-sm', tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400')}>{t === 'builder' ? 'Blocks' : 'JSON'}</button>)}</div>
      {tab === 'json' ? (
        <textarea className={inputCls + ' h-[55vh] font-mono text-xs'} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name" htmlFor="ab-name"><input id="ab-name" className={inputCls} value={a.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Id (stable, no spaces)" htmlFor="ab-id"><input id="ab-id" className={inputCls} value={a.id} onChange={(e) => set({ id: e.target.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} /></Field>
          </div>
          <Field label="Source"><div className="flex flex-wrap gap-1">{SOURCES.map((s) => <Chip key={s} active={a.source === s} onClick={() => set({ source: s })}>{s}</Chip>)}</div></Field>
          <Field label="Rules text"><textarea className={inputCls} value={a.text ?? ''} onChange={(e) => set({ text: e.target.value || undefined })} /></Field>
          <Field label="How it activates">
            <div className="flex flex-wrap gap-1">
              {(['passive', 'toggle', 'declare', 'action'] as const).map((k) => <Chip key={k} active={actKind === k} onClick={() => set({ activation: k === 'action' ? { action: 'standard' } : k })}>{{ passive: 'passive', toggle: 'toggle', declare: 'declare before roll', action: 'takes an action' }[k]}</Chip>)}
              {typeof a.activation === 'object' && (['standard', 'move', 'full', 'swift', 'free', 'immediate'] as const).map((k) => <Chip key={k} tone="blue" active={typeof a.activation === 'object' && a.activation.action === k} onClick={() => set({ activation: { action: k } })}>{k}</Chip>)}
            </div>
            {a.activation === 'declare' && <div className="mt-1 text-xs text-zinc-500">Declare abilities get a toggle chip named after their id; use a "Toggle is on" condition with id "{a.id}".</div>}
          </Field>
          <Field label="Duration when applied as a buff (optional)">
            <div className="flex flex-wrap gap-1"><Chip active={!a.duration} onClick={() => set({ duration: undefined })}>none</Chip></div>
            {a.duration !== undefined ? <DurationPicker value={a.duration} onChange={(d) => set({ duration: d })} /> : <button type="button" className="mt-1 text-sm text-amber-300" onClick={() => set({ duration: { rounds: 10 } })}>+ set duration</button>}
          </Field>
          <Field label="Charges">
            {(a.resources ?? []).map((r, i) => (
              <div key={i} className="mb-1 flex flex-wrap items-center gap-1">
                <input className={inputCls + ' w-32'} placeholder="id" value={r.id} onChange={(e) => set({ resources: a.resources!.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} />
                <input className={inputCls + ' w-28'} placeholder="label" value={r.label ?? ''} onChange={(e) => set({ resources: a.resources!.map((x, j) => (j === i ? { ...x, label: e.target.value || undefined } : x)) })} />
                <input className={inputCls + ' w-24'} placeholder="max" value={String(r.max)} onChange={(e) => set({ resources: a.resources!.map((x, j) => (j === i ? { ...x, max: /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x)) })} />
                {(['day', 'encounter', 'round'] as const).map((p) => <Chip key={p} active={r.per === p} onClick={() => set({ resources: a.resources!.map((x, j) => (j === i ? { ...x, per: p } : x)) })}>/{p}</Chip>)}
                <button type="button" className="px-2 text-zinc-500" onClick={() => set({ resources: a.resources!.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="text-sm text-amber-300" onClick={() => set({ resources: [...(a.resources ?? []), { id: a.id, max: 1, per: 'day' }] })}>+ add charges</button>
          </Field>
          <Field label="Choices the character makes (params)">
            {Object.entries(a.params ?? {}).map(([name, def]) => (
              <div key={name} className="mb-1 flex items-center gap-1">
                <input className={inputCls + ' w-28'} value={name} onChange={(e) => { const p = { ...a.params }; delete p[name]; p[e.target.value] = def; set({ params: p }); }} />
                <input className={inputCls} placeholder="tag category (creatureType…)" value={def.category ?? ''} onChange={(e) => set({ params: { ...a.params, [name]: { ...def, category: e.target.value || undefined } } })} />
                <button type="button" className="px-2 text-zinc-500" onClick={() => { const p = { ...a.params }; delete p[name]; set({ params: Object.keys(p).length ? p : undefined }); }}>✕</button>
              </div>
            ))}
            <button type="button" className="text-sm text-amber-300" onClick={() => set({ params: { ...a.params, types: { kind: 'tags', category: 'creatureType' } } })}>+ add tag choice</button>
          </Field>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Effects</div>
          <div className="space-y-3">
            {a.effects.map((b, i) => (
              <div key={i} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input className={inputCls + ' flex-1'} placeholder="label (shown in breakdown)" value={b.label ?? ''} onChange={(e) => setBlock(i, { label: e.target.value || undefined })} />
                  <button type="button" className="px-2 text-zinc-500" onClick={() => set({ effects: a.effects.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <select className={inputCls + ' mb-2 text-sm'} value={b.trigger} onChange={(e) => setBlock(i, { trigger: e.target.value as Trigger })}>{TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                <div className="mb-1 text-xs text-zinc-400">WHEN</div>
                <ConditionEditor value={b.when} onChange={(c) => setBlock(i, { when: c })} />
                <div className="mb-1 mt-2 text-xs text-zinc-400">DO</div>
                <div className="space-y-1">
                  {b.do.map((e, k) => <EffectEditor key={k} value={e} onChange={(n) => setBlock(i, { do: b.do.map((x, m) => (m === k ? n : x)) })} onRemove={() => setBlock(i, { do: b.do.filter((_, m) => m !== k) })} />)}
                  <button type="button" className="text-sm text-amber-300" onClick={() => setBlock(i, { do: [...b.do, { kind: 'bonus', to: 'attack', value: 1, bonusType: 'untyped' }] })}>+ add effect</button>
                </div>
              </div>
            ))}
            <Button onClick={() => set({ effects: [...a.effects, { id: `e${a.effects.length + 1}`, trigger: 'always', when: { kind: 'always' }, do: [{ kind: 'bonus', to: 'attack', value: 1, bonusType: 'untyped' }] }] })}>+ add effect block</Button>
          </div>
          <Field label="Todo / open question"><input className={inputCls} value={a.todo ?? ''} onChange={(e) => set({ todo: e.target.value || undefined })} /></Field>
        </div>
      )}
      {err && <pre className="mt-2 whitespace-pre-wrap text-xs text-red-300">{err}</pre>}
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={save}>Save</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        {onDelete && <Button variant="danger" className="ml-auto" onClick={onDelete}>Delete</Button>}
      </div>
    </div>
  );
}
