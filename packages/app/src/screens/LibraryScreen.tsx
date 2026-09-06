import { useState } from 'react';
import { MonsterSchema, TagSchema, type Ability, type Monster, type Size, type Tag } from '@hl/engine';
import { useStore } from '../store/store';
import { Button, Chip, Field, Sheet, cx, humanize, inputCls } from '../components/ui';
import { AbilityEditor } from '../components/library/AbilityEditor';

const SOURCES = ['feat', 'class', 'item', 'memory', 'buff', 'condition', 'spell', 'situational', 'core'] as const;
const CATEGORIES = ['creatureType', 'subtype', 'habitat', 'condition', 'custom'] as const;
const SIZES: Size[] = ['fine', 'diminutive', 'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan', 'colossal'];

export function LibraryScreen() {
  const [tab, setTab] = useState<'abilities' | 'tags' | 'monsters'>('abilities');
  return (
    <div className="p-4">
      <h1 className="mb-3 text-2xl font-bold">Library</h1>
      <div className="mb-3 flex gap-1 rounded-xl bg-zinc-900 p-1">
        {(['abilities', 'tags', 'monsters'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cx('flex-1 rounded-lg py-1.5 text-sm', tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400')}>{humanize(t)}</button>)}
      </div>
      {tab === 'abilities' && <Abilities />}
      {tab === 'tags' && <Tags />}
      {tab === 'monsters' && <Monsters />}
    </div>
  );
}

function Abilities() {
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState<string | undefined>();
  const [editing, setEditing] = useState<Ability | undefined>();

  const list = Object.values(library.abilities).filter((a) => (!q || a.name.toLowerCase().includes(q.toLowerCase())) && (!src || a.source === src)).sort((a, b) => a.name.localeCompare(b.name));
  const onChar = (id: string) => character?.abilities.some((x) => x.abilityId === id);
  const save = (parsed: Ability) => {
    const rest = { ...library.abilities };
    if (editing && parsed.id !== editing.id) delete rest[editing.id];
    setLibrary({ ...library, abilities: { ...rest, [parsed.id]: parsed } });
    setEditing(undefined); showToast('Saved');
  };
  const remove = () => {
    if (!editing || !confirm(`Delete ${editing.name}?`)) return;
    const rest = { ...library.abilities }; delete rest[editing.id];
    setLibrary({ ...library, abilities: rest });
    if (character) setCharacter({ ...character, abilities: character.abilities.filter((x) => x.abilityId !== editing.id) });
    setEditing(undefined);
  };
  const toggleOnChar = (id: string) => {
    if (!character) return;
    setCharacter(onChar(id) ? { ...character, abilities: character.abilities.filter((x) => x.abilityId !== id) } : { ...character, abilities: [...character.abilities, { abilityId: id, enabled: true, paramValues: {} }] });
  };
  const fresh = (): Ability => ({ id: `new-${Date.now().toString(36)}`, name: 'New ability', source: 'feat', activation: 'passive', enabledByDefault: true, effects: [{ id: 'e1', trigger: 'always', when: { kind: 'always' }, do: [{ kind: 'bonus', to: 'attack', value: 1, bonusType: 'untyped' }] }] });

  return (
    <div>
      <div className="mb-2 flex gap-2"><input className={inputCls} placeholder="Search abilities…" value={q} onChange={(e) => setQ(e.target.value)} /><Button onClick={() => setEditing(fresh())}>+ New</Button></div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{SOURCES.map((s) => <Chip key={s} active={src === s} onClick={() => setSrc(src === s ? undefined : s)}>{s}</Chip>)}</div>
      <div className="space-y-1">
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900 px-3 py-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(a)}>
              <div className="truncate">{a.name}</div>
              <div className="truncate text-xs text-zinc-500">{a.source} · {a.effects.length} effect{a.effects.length === 1 ? '' : 's'}{a.todo ? ' · ⚑ ' + a.todo : ''}</div>
            </button>
            {character && <button type="button" onClick={() => toggleOnChar(a.id)} className={cx('rounded-full border px-2 py-0.5 text-xs', onChar(a.id) ? 'border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-500')}>{onChar(a.id) ? 'on sheet' : 'add'}</button>}
          </div>
        ))}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.name} tall>
        {editing && <AbilityEditor key={editing.id} initial={editing} onSave={save} onCancel={() => setEditing(undefined)} onDelete={library.abilities[editing.id] ? remove : undefined} />}
      </Sheet>
    </div>
  );
}

function Tags() {
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Tag['category']>('custom');
  const [cat, setCat] = useState<string | undefined>();
  const list = Object.values(library.tags).filter((t) => !cat || t.category === cat).sort((a, b) => a.label.localeCompare(b.label));
  const add = () => {
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!id) return;
    setLibrary({ ...library, tags: { ...library.tags, [id]: TagSchema.parse({ id, label: label.trim(), category }) } });
    setLabel('');
  };
  return (
    <div>
      <p className="mb-2 text-sm text-zinc-400">Tags mark monsters (type, habitat, "red", …) and conditions. Feats check them.</p>
      <div className="mb-2 flex gap-2"><input className={inputCls} placeholder="New tag label, e.g. Red" value={label} onChange={(e) => setLabel(e.target.value)} /><Button onClick={add} disabled={!label.trim()}>Add</Button></div>
      <div className="mb-3 flex flex-wrap gap-1">{CATEGORIES.map((c) => <Chip key={c} tone="blue" active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}</div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1"><Chip active={!cat} onClick={() => setCat(undefined)}>all</Chip>{CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      <div className="flex flex-wrap gap-1">
        {list.map((t) => <Chip key={t.id} onClick={() => { if (confirm(`Delete tag "${t.label}"?`)) { const rest = { ...library.tags }; delete rest[t.id]; setLibrary({ ...library, tags: rest }); } }}>{t.label} <span className="text-zinc-500">· {t.category} ✕</span></Chip>)}
      </div>
    </div>
  );
}

function Monsters() {
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Monster | undefined>();
  const list = Object.values(library.monsters).filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const save = () => {
    if (!editing) return;
    try { const m = MonsterSchema.parse(editing); setLibrary({ ...library, monsters: { ...library.monsters, [m.id]: m } }); setEditing(undefined); } catch (e) { alert((e as Error).message); }
  };
  const tags = Object.values(library.tags).filter((t) => t.category !== 'condition' && t.category !== 'size');
  return (
    <div>
      <div className="mb-2 flex gap-2"><input className={inputCls} placeholder="Search monsters…" value={q} onChange={(e) => setQ(e.target.value)} /><Button onClick={() => setEditing({ id: `m-${Date.now().toString(36)}`, name: 'New monster', tags: [], size: 'medium', lore: { sections: [] } })}>+ New</Button></div>
      <div className="space-y-1">
        {list.map((m) => (
          <button key={m.id} type="button" onClick={() => setEditing(m)} className="flex w-full items-center justify-between rounded-xl bg-zinc-900 px-3 py-2 text-left">
            <span>{m.name}<span className="ml-2 text-xs text-zinc-500">{humanize(m.size)}{m.cr !== undefined ? ` · CR ${m.cr}` : ''}</span></span>
            <span className="text-xs text-zinc-500">{m.tags.slice(0, 3).map((t) => library.tags[t]?.label ?? t).join(', ')}</span>
          </button>
        ))}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.name} tall>
        {editing && (
          <div>
            <Field label="Name"><input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CR"><input className={inputCls} value={editing.cr ?? ''} onChange={(e) => setEditing({ ...editing, cr: e.target.value === '' ? undefined : Number(e.target.value) || e.target.value })} /></Field>
              <Field label="Senses"><input className={inputCls} value={editing.senses ?? ''} onChange={(e) => setEditing({ ...editing, senses: e.target.value || undefined })} /></Field>
            </div>
            <Field label="Size"><div className="flex flex-wrap gap-1">{SIZES.map((s) => <Chip key={s} active={editing.size === s} onClick={() => setEditing({ ...editing, size: s })}>{humanize(s)}</Chip>)}</div></Field>
            <Field label="Tags"><div className="flex flex-wrap gap-1">{tags.map((t) => <Chip key={t.id} active={editing.tags.includes(t.id)} onClick={() => setEditing({ ...editing, tags: editing.tags.includes(t.id) ? editing.tags.filter((x) => x !== t.id) : [...editing.tags, t.id] })}>{t.label}</Chip>)}</div></Field>
            <Field label="Lore summary"><textarea className={inputCls} value={editing.lore?.summary ?? ''} onChange={(e) => setEditing({ ...editing, lore: { sections: editing.lore?.sections ?? [], summary: e.target.value || undefined } })} /></Field>
            {(editing.lore?.sections ?? []).map((s, i) => (
              <div key={i} className="mb-2 rounded-xl border border-zinc-800 p-2">
                <div className="flex gap-2"><input className={inputCls} value={s.title} onChange={(e) => setEditing({ ...editing, lore: { ...editing.lore!, sections: editing.lore!.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) } })} /><button type="button" className="text-zinc-500" onClick={() => setEditing({ ...editing, lore: { ...editing.lore!, sections: editing.lore!.sections.filter((_, j) => j !== i) } })}>✕</button></div>
                <textarea className={inputCls + ' mt-1'} value={s.body} onChange={(e) => setEditing({ ...editing, lore: { ...editing.lore!, sections: editing.lore!.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) } })} />
              </div>
            ))}
            <button type="button" className="mb-3 text-sm text-amber-300" onClick={() => setEditing({ ...editing, lore: { ...(editing.lore ?? {}), sections: [...(editing.lore?.sections ?? []), { title: 'Section', body: '' }] } })}>+ lore section</button>
            <Field label="Notes"><textarea className={inputCls} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || undefined })} /></Field>
            <div className="flex gap-2">
              <Button variant="primary" onClick={save}>Save</Button>
              {library.monsters[editing.id] && <Button variant="danger" className="ml-auto" onClick={() => { if (confirm(`Delete ${editing.name}?`)) { const rest = { ...library.monsters }; delete rest[editing.id]; setLibrary({ ...library, monsters: rest }); setEditing(undefined); } }}>Delete</Button>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
