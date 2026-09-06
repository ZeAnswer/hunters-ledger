import { type Ability, type EvalContext } from '@hl/engine';
import { useStore } from '../../store/store';
import { Button, Chip, Field, Sheet } from '../ui';

/** Per-character settings for one ability: enabled, chosen tags for params, rules text. */
export function AbilitySheet({ ctx, ability, onClose }: { ctx: EvalContext; ability: Ability; onClose: () => void }) {
  const setCharacter = useStore((s) => s.setCharacter);
  const c = ctx.character;
  const inst = c.abilities.find((x) => x.abilityId === ability.id);
  if (!inst) return null;
  const update = (patch: Partial<typeof inst>) => setCharacter({ ...c, abilities: c.abilities.map((x) => (x.abilityId === ability.id ? { ...x, ...patch } : x)) });
  const tags = Object.values(ctx.library.tags);

  return (
    <Sheet open onClose={onClose} title={ability.name} tall>
      <div className="mb-3 flex items-center gap-2">
        <Chip tone="green" active={inst.enabled} onClick={() => update({ enabled: !inst.enabled })}>{inst.enabled ? 'Enabled' : 'Disabled'}</Chip>
        <span className="text-xs text-zinc-500">{ability.source}{ability.sourceRef ? ` · ${ability.sourceRef}` : ''}</span>
      </div>
      {ability.text && <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-300">{ability.text}</p>}
      {ability.todo && <p className="mb-3 rounded-xl border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">⚑ {ability.todo}</p>}
      {Object.entries(ability.params ?? {}).map(([name, def]) => {
        const chosen = inst.paramValues[name] ?? [];
        const options = tags.filter((t) => !def.category || t.category === def.category).sort((a, b) => a.label.localeCompare(b.label));
        return (
          <Field key={name} label={`${def.label ?? name}${def.count ? ` (pick ${def.count})` : ''}`}>
            <div className="flex flex-wrap gap-1">
              {options.map((t) => <Chip key={t.id} tone="amber" active={chosen.includes(t.id)} onClick={() => update({ paramValues: { ...inst.paramValues, [name]: chosen.includes(t.id) ? chosen.filter((x) => x !== t.id) : [...chosen, t.id] } })}>{t.label}</Chip>)}
            </div>
          </Field>
        );
      })}
      {ability.resources?.map((r) => {
        const used = c.resourceState[r.id]?.used ?? 0;
        return r.per === 'day' ? (
          <Field key={r.id} label={`${r.label ?? r.id} used today`}>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCharacter({ ...c, resourceState: { ...c.resourceState, [r.id]: { used: Math.max(0, used - 1) } } })}>−</Button>
              <span className="tabular-nums">{used} / {typeof r.max === 'number' ? r.max : r.max}</span>
              <Button size="sm" onClick={() => setCharacter({ ...c, resourceState: { ...c.resourceState, [r.id]: { used: used + 1 } } })}>+</Button>
            </div>
          </Field>
        ) : null;
      })}
      <div className="mb-3 text-xs text-zinc-500">{ability.effects.length} effect block{ability.effects.length === 1 ? '' : 's'}. Edit the logic in Library.</div>
      <Button variant="danger" onClick={() => { if (confirm(`Remove ${ability.name} from ${c.name}?`)) { setCharacter({ ...c, abilities: c.abilities.filter((x) => x.abilityId !== ability.id) }); onClose(); } }}>Remove from character</Button>
    </Sheet>
  );
}
