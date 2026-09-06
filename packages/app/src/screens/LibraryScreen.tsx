import { useState } from 'react';
import { AbilitySchema, type Ability } from '@hl/engine';
import { useStore } from '../store/store';
import { Button, Chip, Sheet, cx, inputCls } from '../components/ui';

const SOURCES = ['feat', 'class', 'item', 'memory', 'buff', 'condition', 'spell', 'situational', 'core'] as const;

export function LibraryScreen() {
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState<string | undefined>();
  const [editing, setEditing] = useState<Ability | undefined>();
  const [json, setJson] = useState('');
  const [err, setErr] = useState<string | undefined>();

  const list = Object.values(library.abilities).filter((a) => (!q || a.name.toLowerCase().includes(q.toLowerCase())) && (!src || a.source === src)).sort((a, b) => a.name.localeCompare(b.name));
  const onChar = (id: string) => character?.abilities.some((x) => x.abilityId === id);

  const open = (a: Ability) => { setEditing(a); setJson(JSON.stringify(a, null, 2)); setErr(undefined); };
  const save = () => {
    try {
      const parsed = AbilitySchema.parse(JSON.parse(json));
      setLibrary({ ...library, abilities: { ...library.abilities, [parsed.id]: parsed } });
      if (editing && parsed.id !== editing.id) { const rest = { ...library.abilities }; delete rest[editing.id]; setLibrary({ ...library, abilities: { ...rest, [parsed.id]: parsed } }); }
      setEditing(undefined); showToast('Saved');
    } catch (e) { setErr((e as Error).message); }
  };
  const newAbility = () => open({ id: 'new-ability', name: 'New ability', source: 'feat', activation: 'passive', enabledByDefault: true, effects: [{ id: 'e1', trigger: 'always', when: { kind: 'always' }, do: [{ kind: 'bonus', to: 'attack', value: 1, bonusType: 'untyped' }] }] });
  const toggleOnChar = (id: string) => {
    if (!character) return;
    setCharacter(onChar(id) ? { ...character, abilities: character.abilities.filter((x) => x.abilityId !== id) } : { ...character, abilities: [...character.abilities, { abilityId: id, enabled: true, paramValues: {} }] });
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between"><h1 className="text-2xl font-bold">Library</h1><Button size="sm" onClick={newAbility}>+ New</Button></div>
      <input className={inputCls + ' mb-2'} placeholder="Search abilities…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{SOURCES.map((s) => <Chip key={s} active={src === s} onClick={() => setSrc(src === s ? undefined : s)}>{s}</Chip>)}</div>
      <div className="mb-2 text-xs text-zinc-500">{Object.keys(library.abilities).length} abilities · {Object.keys(library.tags).length} tags · {Object.keys(library.monsters).length} monsters. Visual block builder coming; for now edit JSON.</div>
      <div className="space-y-1">
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900 px-3 py-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(a)}>
              <div className="truncate">{a.name}</div>
              <div className="truncate text-xs text-zinc-500">{a.source} · {a.effects.length} effect{a.effects.length === 1 ? '' : 's'}{a.todo ? ' · ⚑ ' + a.todo : ''}</div>
            </button>
            {character && <button type="button" onClick={() => toggleOnChar(a.id)} className={cx('rounded-full border px-2 py-0.5 text-xs', onChar(a.id) ? 'border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-500')}>{onChar(a.id) ? 'on sheet' : 'add'}</button>}
          </div>
        ))}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.name} tall>
        <textarea className={inputCls + ' h-[60vh] font-mono text-xs'} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        {err && <pre className="mt-2 whitespace-pre-wrap text-xs text-red-300">{err}</pre>}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={save}>Save</Button>
          <Button variant="danger" onClick={() => { if (editing && confirm(`Delete ${editing.name}?`)) { const rest = { ...library.abilities }; delete rest[editing.id]; setLibrary({ ...library, abilities: rest }); setEditing(undefined); } }}>Delete</Button>
        </div>
      </Sheet>
    </div>
  );
}
