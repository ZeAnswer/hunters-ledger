import { useState } from 'react';
import { AbilitySchema, SLOTS, type Ability, type Cost, type EffectBlock, type ItemCategory, type Origin, type Trigger } from '@hl/engine';
import { Button, Chip, Field, cx, inputCls } from '../ui';
import { ConditionEditor } from './ConditionEditor';
import { DurationPicker, EffectEditor } from './EffectEditor';
import { useStore } from '../../store/store';

const ORIGINS: Origin[] = ['feat', 'classFeature', 'race', 'item', 'spell', 'buff', 'condition', 'memory', 'situational', 'monster', 'core'];
const TRIGGERS: { id: Trigger; label: string }[] = [
  { id: 'always', label: 'While conditions hold (passive)' }, { id: 'onUse', label: 'When I use it' }, { id: 'onActivate', label: 'When switched on' }, { id: 'onDeactivate', label: 'When switched off' },
  { id: 'onHit', label: 'When I hit' }, { id: 'onMiss', label: 'When I miss' }, { id: 'onCrit', label: 'When I crit' }, { id: 'onDamaged', label: 'When I take damage' }, { id: 'onRoundStart', label: 'At round start' }, { id: 'onRoundEnd', label: 'At round end' },
];
const ACTIONS = ['free', 'swift', 'immediate', 'move', 'standard', 'fullRound'] as const;
const ITEM_CATEGORIES: ItemCategory[] = ['weapon', 'armor', 'shield', 'ammunition', 'wondrous', 'potion', 'scroll', 'wand', 'tool', 'trophy', 'material', 'gear'];
/** Categories that occupy a body slot; the slot must be chosen. */
const SLOTTED: Partial<Record<ItemCategory, readonly string[]>> = { weapon: ['mainHand', 'offHand'], armor: ['armor'], shield: ['offHand', 'buckler'], ammunition: ['quiver'], wondrous: SLOTS.map((s) => s.id), trophy: SLOTS.map((s) => s.id), tool: ['mainHand', 'offHand', 'none'] };

export function AbilityEditor({ initial, onSave, onDelete, onCancel }: { initial: Ability; onSave: (a: Ability) => void; onDelete?: () => void; onCancel: () => void }) {
  const library = useStore((s) => s.library);
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
      if (!parsed.name.trim()) throw new Error('name required');
      if (parsed.origin === 'item' && parsed.item && SLOTTED[parsed.item.category] && !parsed.item.slot) throw new Error(`Choose a body slot for this ${parsed.item.category}`);
      onSave(parsed);
    } catch (e) { setErr((e as Error).message); }
  };
  const act = a.activation;
  const actKind = typeof act === 'string' ? act : 'action' in act ? 'action' : 'reaction';
  const item = a.item;
  const itemSet = (patch: Partial<NonNullable<Ability['item']>>) => set({ item: { category: 'gear', tags: [], ...(item ?? {}), ...patch } });
  const abilityOptions = Object.values(library.abilities).sort((x, y) => x.name.localeCompare(y.name));

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
          <Field label="Origin"><div className="flex flex-wrap gap-1">{ORIGINS.map((o) => <Chip key={o} active={a.origin === o} onClick={() => set({ origin: o, ...(o === 'item' && !a.item ? { item: { category: 'gear', tags: [] } } : {}) })}>{o}</Chip>)}</div></Field>
          {a.origin === 'classFeature' && <div className="grid grid-cols-2 gap-2"><Field label="Class"><select className={inputCls} value={a.classId ?? ''} onChange={(e) => set({ classId: e.target.value || undefined })}><option value="">—</option>{Object.values(library.classTables).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Gained at class level"><input className={inputCls} inputMode="numeric" value={a.classLevel ?? ''} onChange={(e) => set({ classLevel: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field></div>}
          <Field label="Rules text"><textarea className={inputCls} value={a.text ?? ''} onChange={(e) => set({ text: e.target.value || undefined })} /></Field>
          <Field label="Source reference"><input className={inputCls} value={a.sourceRef ?? ''} onChange={(e) => set({ sourceRef: e.target.value || undefined })} placeholder="PHB p.98, DM card…" /></Field>

          {a.origin === 'item' && (() => { const cat = item?.category ?? 'gear'; const slots = SLOTTED[cat]; return (
            <div className="mb-3 rounded-2xl border border-zinc-800 p-2">
              <Field label="Item category" htmlFor="item-cat"><select id="item-cat" className={inputCls} value={cat} onChange={(e) => { const nc = e.target.value as ItemCategory; const ns = SLOTTED[nc]; itemSet({ category: nc, slot: ns ? (ns.length === 1 ? (ns[0] as never) : undefined) : undefined }); }}>{ITEM_CATEGORIES.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
              {slots && (
                <Field label={`Body slot${item?.slot ? '' : ' — choose one'}`}>
                  <div className="flex flex-wrap gap-1">
                    {slots.map((id) => <Chip key={id} tone="amber" active={item?.slot === id} onClick={() => itemSet({ slot: id as never })}>{id === 'none' ? 'No slot (active when carried)' : SLOTS.find((s) => s.id === id)?.label ?? id}</Chip>)}
                    {(cat === 'wondrous' || cat === 'trophy') && <Chip tone="amber" active={item?.slot === 'none'} onClick={() => itemSet({ slot: 'none' })}>No slot (active when carried)</Chip>}
                  </div>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Weight (lb)"><input className={inputCls} inputMode="decimal" value={item?.weight ?? ''} onChange={(e) => itemSet({ weight: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                <Field label="Price"><input className={inputCls} value={item?.price ?? ''} onChange={(e) => itemSet({ price: e.target.value || undefined })} /></Field>
              </div>
              <Field label="Item tags (bow, longbow, trophy-aberration…)"><input className={inputCls} value={(item?.tags ?? []).join(', ')} onChange={(e) => itemSet({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} /></Field>
              {cat === 'weapon' && (() => { const w = item?.weapon ?? { kind: 'melee' as const, dice: '1d8', critRange: 20, critMult: 2, attackAbility: 'str' as const, damageAbility: 'str' as const, damageAbilityMultiplier: 1, enhancement: 0, tags: [] }; const ws = (p: Partial<typeof w>) => itemSet({ weapon: { ...w, ...p } }); return (
                <div className="rounded-xl bg-zinc-950 p-2">
                  <div className="mb-1 text-xs uppercase text-zinc-500">Weapon profile</div>
                  <div className="flex flex-wrap gap-1 mb-1">{(['melee', 'ranged'] as const).map((k) => <Chip key={k} active={w.kind === k} onClick={() => ws({ kind: k, attackAbility: k === 'ranged' ? 'dex' : 'str' })}>{k}</Chip>)}</div>
                  <div className="grid grid-cols-3 gap-1">
                    <input className={inputCls} placeholder="dice 1d8" value={w.dice} onChange={(e) => ws({ dice: e.target.value })} />
                    <input className={inputCls} placeholder="crit from (20)" inputMode="numeric" value={w.critRange} onChange={(e) => ws({ critRange: Number(e.target.value) || 20 })} />
                    <input className={inputCls} placeholder="×mult" inputMode="numeric" value={w.critMult} onChange={(e) => ws({ critMult: Number(e.target.value) || 2 })} />
                    <input className={inputCls} placeholder="enhancement" inputMode="numeric" value={w.enhancement} onChange={(e) => ws({ enhancement: Number(e.target.value) || 0 })} />
                    <input className={inputCls} placeholder="range ft" inputMode="numeric" value={w.rangeIncrement ?? ''} onChange={(e) => ws({ rangeIncrement: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input className={inputCls} placeholder="max Str to dmg" inputMode="numeric" value={w.maxDamageAbilityBonus ?? ''} onChange={(e) => ws({ maxDamageAbilityBonus: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-400">attack uses <select className={inputCls + ' w-auto py-1'} value={w.attackAbility} onChange={(e) => ws({ attackAbility: e.target.value as 'str' })}>{['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => <option key={k} value={k}>{k.toUpperCase()}</option>)}</select> damage uses <select className={inputCls + ' w-auto py-1'} value={w.damageAbility ?? ''} onChange={(e) => ws({ damageAbility: (e.target.value || undefined) as 'str' | undefined })}><option value="">none</option>{['str', 'dex'].map((k) => <option key={k} value={k}>{k.toUpperCase()}</option>)}</select> ×<input className={inputCls + ' w-14 py-1'} value={w.damageAbilityMultiplier} onChange={(e) => ws({ damageAbilityMultiplier: Number(e.target.value) || 1 })} /></div>
                </div>
              ); })()}
            </div>
          ); })()}

          <Field label="Binding (when do its effects apply?)">
            <div className="flex flex-wrap gap-1">
              <Chip active={a.binding === 'none'} onClick={() => set({ binding: 'none' })}>always (while owned / enabled)</Chip>
              <Chip active={a.binding === 'thisWeapon'} onClick={() => set({ binding: 'thisWeapon' })}>only when attacking with this weapon</Chip>
              <Chip active={typeof a.binding === 'object'} onClick={() => set({ binding: { slot: 'arms' } })}>only while something is in a slot</Chip>
              {typeof a.binding === 'object' && <select className={inputCls + ' w-auto py-1'} value={a.binding.slot} onChange={(e) => set({ binding: { slot: e.target.value as never } })}>{SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>}
            </div>
          </Field>

          <Field label="Activation">
            <div className="flex flex-wrap gap-1">
              {(['passive', 'toggle', 'declare', 'atWill', 'action', 'reaction'] as const).map((k) => <Chip key={k} active={actKind === k} onClick={() => set({ activation: k === 'action' ? { action: 'standard' } : k === 'reaction' ? { reaction: 'onDamaged' } : k })}>{{ passive: 'passive', toggle: 'toggle (on/off)', declare: 'declare before roll', atWill: 'at will', action: 'takes an action', reaction: 'reaction to an event' }[k]}</Chip>)}
            </div>
            {actKind === 'action' && typeof act === 'object' && 'action' in act && <div className="mt-1 flex flex-wrap gap-1">{ACTIONS.map((k) => <Chip key={k} tone="blue" active={act.action === k} onClick={() => set({ activation: { action: k } })}>{k}</Chip>)}<Chip tone="blue" active={typeof act.action === 'object'} onClick={() => set({ activation: { action: { minutes: 1 } } })}>minutes…</Chip>{typeof act.action === 'object' && 'minutes' in act.action && <input className={inputCls + ' w-16 py-1'} inputMode="numeric" value={act.action.minutes} onChange={(e) => set({ activation: { action: { minutes: Number(e.target.value) || 1 } } })} />}</div>}
            {actKind === 'reaction' && typeof act === 'object' && 'reaction' in act && <select className={inputCls + ' mt-1'} value={act.reaction} onChange={(e) => set({ activation: { reaction: e.target.value as Trigger } })}>{TRIGGERS.filter((t) => t.id !== 'always').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>}
            {a.activation === 'declare' && <div className="mt-1 text-xs text-zinc-500">Shows a chip named after its id; condition it with "Battle → declared / toggle" = {a.id}.</div>}
            {a.activation === 'toggle' && <div className="mt-1 text-xs text-zinc-500">Effects apply only while switched on. Charge costs are paid on activation; add an "At round start" block that spends charges for per-round use.</div>}
          </Field>

          <Field label="Cost">
            {a.cost.map((c, i) => (
              <div key={i} className="mb-1 flex flex-wrap items-center gap-1">
                <select className={inputCls + ' w-auto py-1.5'} value={c.kind} onChange={(e) => { const k = e.target.value as Cost['kind']; const nc: Cost = k === 'charge' ? { kind: 'charge', resourceId: a.resources[0]?.id ?? '', amount: 1 } : k === 'item' ? { kind: 'item', abilityId: a.id, quantity: 1 } : k === 'spellSlot' ? { kind: 'spellSlot', level: 1 } : { kind: k, amount: 1 } as Cost; set({ cost: a.cost.map((x, j) => (j === i ? nc : x)) }); }}>{['charge', 'gold', 'xp', 'hp', 'item', 'spellSlot'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
                {c.kind === 'charge' && <><input className={inputCls + ' w-32 py-1.5'} placeholder="resource id" value={c.resourceId} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, resourceId: e.target.value } : x)) })} /><input className={inputCls + ' w-16 py-1.5'} value={String(c.amount)} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, amount: /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x)) })} /></>}
                {(c.kind === 'gold' || c.kind === 'xp') && <input className={inputCls + ' w-24 py-1.5'} inputMode="numeric" value={c.amount} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, amount: Number(e.target.value) || 0 } : x)) })} />}
                {c.kind === 'hp' && <input className={inputCls + ' w-24 py-1.5'} value={String(c.amount)} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, amount: /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x)) })} />}
                {c.kind === 'item' && <><select className={inputCls + ' w-40 py-1.5'} value={c.abilityId} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, abilityId: e.target.value } : x)) })}>{abilityOptions.filter((x) => x.item).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><input className={inputCls + ' w-16 py-1.5'} inputMode="numeric" value={c.quantity} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, quantity: Number(e.target.value) || 1 } : x)) })} /></>}
                {c.kind === 'spellSlot' && <input className={inputCls + ' w-16 py-1.5'} inputMode="numeric" value={c.level} onChange={(e) => set({ cost: a.cost.map((x, j) => (j === i ? { ...c, level: Number(e.target.value) || 1 } : x)) })} />}
                <button type="button" className="px-2 text-zinc-500" onClick={() => set({ cost: a.cost.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="text-sm text-amber-300" onClick={() => set({ cost: [...a.cost, { kind: 'charge', resourceId: a.resources[0]?.id ?? a.id, amount: 1 }] })}>+ add cost</button>
          </Field>

          <Field label="Charges (resources)">
            {a.resources.map((r, i) => (
              <div key={i} className="mb-1 flex flex-wrap items-center gap-1">
                <input className={inputCls + ' w-32 py-1.5'} placeholder="id" value={r.id} onChange={(e) => set({ resources: a.resources.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} />
                <input className={inputCls + ' w-28 py-1.5'} placeholder="label" value={r.label ?? ''} onChange={(e) => set({ resources: a.resources.map((x, j) => (j === i ? { ...x, label: e.target.value || undefined } : x)) })} />
                <input className={inputCls + ' w-24 py-1.5'} placeholder="max" value={String(r.max)} onChange={(e) => set({ resources: a.resources.map((x, j) => (j === i ? { ...x, max: /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value } : x)) })} />
                <select className={inputCls + ' w-auto py-1.5'} value={r.resetOn} onChange={(e) => set({ resources: a.resources.map((x, j) => (j === i ? { ...x, resetOn: e.target.value as never } : x)) })}>{['round', 'encounter', 'day', 'rest', 'manual', 'never'].map((k) => <option key={k} value={k}>resets per {k}</option>)}</select>
                <select className={inputCls + ' w-auto py-1.5'} value={r.resetTo} onChange={(e) => set({ resources: a.resources.map((x, j) => (j === i ? { ...x, resetTo: e.target.value as never } : x)) })}><option value="max">charges (max → 0)</option><option value="zero">counter (0 → max)</option></select>
                <button type="button" className="px-2 text-zinc-500" onClick={() => set({ resources: a.resources.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="text-sm text-amber-300" onClick={() => set({ resources: [...a.resources, { id: a.id, max: 1, resetOn: 'day', resetTo: 'max' }] })}>+ add charges</button>
          </Field>

          <Field label="Duration when applied as a buff / granted (optional)">
            {a.duration !== undefined ? <div className="flex items-center gap-2"><DurationPicker value={a.duration} onChange={(d) => set({ duration: d })} /><button type="button" className="text-xs text-zinc-500" onClick={() => set({ duration: undefined })}>clear</button></div> : <button type="button" className="text-sm text-amber-300" onClick={() => set({ duration: { rounds: 10 } })}>+ set duration</button>}
          </Field>

          <Field label="Choices the character makes (params)">
            {Object.entries(a.params ?? {}).map(([name, def]) => (
              <div key={name} className="mb-1 flex items-center gap-1">
                <input className={inputCls + ' w-28'} value={name} onChange={(e) => { const p = { ...a.params }; delete p[name]; p[e.target.value] = def; set({ params: p }); }} />
                <select className={inputCls + ' w-auto'} value={def.kind} onChange={(e) => set({ params: { ...a.params, [name]: e.target.value === 'tags' ? { kind: 'tags', category: 'creatureType' } : e.target.value === 'number' ? { kind: 'number' } : { kind: 'choice', options: [] } } })}><option value="tags">tags</option><option value="number">number</option><option value="choice">choice</option></select>
                {def.kind === 'tags' && <input className={inputCls} placeholder="tag category" value={def.category ?? ''} onChange={(e) => set({ params: { ...a.params, [name]: { ...def, category: e.target.value || undefined } } })} />}
                {def.kind === 'choice' && <input className={inputCls} placeholder="options, comma separated" value={def.options.join(', ')} onChange={(e) => set({ params: { ...a.params, [name]: { ...def, options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } } })} />}
                <button type="button" className="px-2 text-zinc-500" onClick={() => { const p = { ...a.params }; delete p[name]; set({ params: Object.keys(p).length ? p : undefined }); }}>✕</button>
              </div>
            ))}
            <button type="button" className="text-sm text-amber-300" onClick={() => set({ params: { ...a.params, types: { kind: 'tags', category: 'creatureType' } } })}>+ add choice</button>
          </Field>

          <Field label="Grants (sub-abilities listed separately, e.g. spells from an item)">
            <div className="mb-1 flex flex-wrap gap-1">{a.grants.map((g) => <Chip key={g} active onClick={() => set({ grants: a.grants.filter((x) => x !== g) })}>{library.abilities[g]?.name ?? g} ✕</Chip>)}</div>
            <select className={inputCls} value="" onChange={(e) => e.target.value && !a.grants.includes(e.target.value) && set({ grants: [...a.grants, e.target.value] })}><option value="">+ add granted ability…</option>{abilityOptions.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.origin})</option>)}</select>
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
                  <button type="button" className="text-sm text-amber-300" onClick={() => setBlock(i, { do: [...b.do, { verb: 'modify', to: 'attack', value: 1, type: 'untyped', mode: 'add' }] })}>+ add effect</button>
                </div>
              </div>
            ))}
            <Button onClick={() => set({ effects: [...a.effects, { id: `e${a.effects.length + 1}`, trigger: 'always', when: { all: [] }, do: [{ verb: 'modify', to: 'attack', value: 1, type: 'untyped', mode: 'add' }] }] })}>+ add effect block</Button>
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
