import { useState } from 'react';
import { addInventoryItem, removeInventoryItem, setEquipped, type InventoryItem } from '@hl/engine';
import { useStore } from '../store/store';
import { useCtx } from '../store/hooks';
import { Button, Chip, Field, Sheet, cx, humanize, inputCls } from '../components/ui';
import { AbilitySheet } from '../components/character/AbilitySheet';

const CATEGORIES: InventoryItem['category'][] = ['weapon', 'armor', 'wondrous', 'consumable', 'trophy', 'material', 'gear'];

export function InventoryScreen() {
  const ctx = useCtx();
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const [tab, setTab] = useState<'equipped' | 'storage'>('equipped');
  const [editing, setEditing] = useState<InventoryItem | undefined>();
  const [abilityId, setAbilityId] = useState<string | undefined>();
  if (!ctx) return <div className="p-4 text-zinc-500">No character.</div>;
  const c = ctx.character;
  const items = c.inventory.filter((i) => (tab === 'equipped' ? i.equipped : !i.equipped));
  const groups = CATEGORIES.map((cat) => ({ cat, items: items.filter((i) => i.category === cat) })).filter((g) => g.items.length);
  const toggle = (i: InventoryItem) => { setCharacter(setEquipped(c, i.id, !i.equipped)); showToast(`${i.name}: ${i.equipped ? 'stored' : 'equipped'}`); };
  const save = () => {
    if (!editing) return;
    const exists = c.inventory.some((i) => i.id === editing.id);
    setCharacter(exists ? { ...c, inventory: c.inventory.map((i) => (i.id === editing.id ? editing : i)) } : addInventoryItem(c, editing));
    setEditing(undefined);
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between"><h1 className="text-2xl font-bold">Inventory</h1><Button size="sm" onClick={() => setEditing({ id: `new-${Date.now().toString(36)}`, name: '', quantity: 1, equipped: tab === 'equipped', category: 'gear' })}>+ Add</Button></div>
      <div className="mb-3 flex gap-1 rounded-xl bg-zinc-900 p-1">
        {(['equipped', 'storage'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cx('flex-1 rounded-lg py-1.5 text-sm', tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400')}>{t === 'equipped' ? `Equipped (${c.inventory.filter((i) => i.equipped).length})` : `Storage (${c.inventory.filter((i) => !i.equipped).length})`}</button>)}
      </div>
      {groups.length === 0 && <p className="text-sm text-zinc-500">Nothing here.</p>}
      {groups.map((g) => (
        <div key={g.cat} className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{humanize(g.cat)}</div>
          <div className="space-y-1">
            {g.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900 px-3 py-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (i.abilityId && ctx.library.abilities[i.abilityId] ? setAbilityId(i.abilityId) : setEditing(i))}>
                  <div className="truncate">{i.name}{i.quantity !== 1 ? <span className="ml-1 text-zinc-400">×{i.quantity}</span> : null}{i.abilityId ? <span className="ml-1 text-amber-400" title="has rules">✦</span> : null}</div>
                  {i.notes && <div className="truncate text-xs text-zinc-500">{i.notes.split('\n')[0]}</div>}
                </button>
                <Button size="sm" variant={i.equipped ? 'ghost' : 'default'} onClick={() => toggle(i)}>{i.equipped ? 'Unequip' : 'Equip'}</Button>
                <button type="button" className="px-1 text-zinc-500" onClick={() => setEditing(i)}>✎</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.name || 'New item'}>
        {editing && (
          <div>
            <Field label="Name" htmlFor="it-name"><input id="it-name" className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quantity"><input className={inputCls} inputMode="numeric" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) || 0 })} /></Field>
              <Field label="Weight (lb)"><input className={inputCls} inputMode="decimal" value={editing.weight ?? ''} onChange={(e) => setEditing({ ...editing, weight: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
            </div>
            <Field label="Category"><div className="flex flex-wrap gap-1">{CATEGORIES.map((k) => <Chip key={k} active={editing.category === k} onClick={() => setEditing({ ...editing, category: k })}>{humanize(k)}</Chip>)}</div></Field>
            <Field label="Rules (ability from the library, optional)">
              <select className={inputCls} value={editing.abilityId ?? ''} onChange={(e) => setEditing({ ...editing, abilityId: e.target.value || undefined })}>
                <option value="">— none, plain item —</option>
                {Object.values(ctx.library.abilities).filter((a) => a.source === 'item').sort((a, b) => a.name.localeCompare(b.name)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Notes"><textarea className={inputCls} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || undefined })} /></Field>
            <div className="flex gap-2">
              <Button variant="primary" onClick={save} disabled={!editing.name.trim()}>Save</Button>
              {c.inventory.some((i) => i.id === editing.id) && <Button variant="danger" className="ml-auto" onClick={() => { if (confirm(`Delete ${editing.name}?`)) { setCharacter(removeInventoryItem(c, editing.id)); setEditing(undefined); } }}>Delete</Button>}
            </div>
          </div>
        )}
      </Sheet>
      {abilityId && ctx.library.abilities[abilityId] && <AbilitySheet ctx={ctx} ability={ctx.library.abilities[abilityId]!} onClose={() => setAbilityId(undefined)} />}
    </div>
  );
}
