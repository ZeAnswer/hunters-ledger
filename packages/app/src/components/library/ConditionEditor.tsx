import type { Condition, Hurt, Size } from '@hl/engine';
import { useStore } from '../../store/store';
import { Chip, cx, inputCls } from '../ui';
import { TagSelect } from './StatSelect';

type Kind = Condition['kind'];

const GROUPS: { label: string; kinds: Kind[] }[] = [
  { label: 'Combine', kinds: ['all', 'any', 'not', 'always'] },
  { label: 'Target', kinds: ['target.hasTag', 'target.tagIn', 'target.sizeAtLeast', 'target.hurtAtMost', 'target.hasCondition', 'param'] },
  { label: 'Me', kinds: ['self.hasBuff', 'self.hasCondition', 'self.abilityEnabled', 'toggle', 'resource'] },
  { label: 'Attack', kinds: ['attack.kind', 'attack.withinFeet', 'attack.isFirstThisRound', 'attack.index'] },
  { label: 'Memory', kinds: ['log', 'used', 'prompt', 'round'] },
];

export const KIND_LABEL: Record<Kind, string> = {
  always: 'Always', all: 'ALL of', any: 'ANY of', not: 'NOT',
  'target.hasTag': 'Target has tag', 'target.tagIn': 'Target has one of tags', 'target.sizeAtLeast': 'Target size at least', 'target.hurtAtMost': 'Target hurt at least', 'target.hasCondition': 'Target has condition',
  'self.hasBuff': 'I have buff', 'self.hasCondition': 'I have condition', 'self.abilityEnabled': 'My ability enabled', toggle: 'Toggle is on', resource: 'Charges left',
  'attack.kind': 'Attack is', 'attack.withinFeet': 'Target within feet', 'attack.isFirstThisRound': 'First attack this round', 'attack.index': 'Attack number is',
  log: 'Battle log', used: 'Ability already used', prompt: 'Check entered', round: 'Round number', param: 'Target matches my chosen types',
};

function defaultFor(kind: Kind): Condition {
  switch (kind) {
    case 'all': return { kind, of: [] };
    case 'any': return { kind, of: [] };
    case 'not': return { kind, of: { kind: 'always' } };
    case 'always': return { kind };
    case 'target.hasTag': return { kind, tag: '' };
    case 'target.tagIn': return { kind, tags: [] };
    case 'target.sizeAtLeast': return { kind, size: 'large' };
    case 'target.hurtAtMost': return { kind, hurt: 'bloodied' };
    case 'target.hasCondition': return { kind, condition: 'flanked' };
    case 'self.hasBuff': return { kind, abilityId: '' };
    case 'self.hasCondition': return { kind, condition: '' };
    case 'self.abilityEnabled': return { kind, abilityId: '' };
    case 'attack.kind': return { kind, attackKind: 'ranged' };
    case 'attack.withinFeet': return { kind, feet: 30 };
    case 'attack.isFirstThisRound': return { kind };
    case 'attack.index': return { kind, index: 1 };
    case 'log': return { kind, event: 'miss', target: 'current', scope: 'thisRound' };
    case 'used': return { kind, abilityId: '', scope: 'encounter' };
    case 'resource': return { kind, id: '', remainingAtLeast: 1 };
    case 'toggle': return { kind, id: '' };
    case 'prompt': return { kind, id: 'knowledge', perTagCategory: 'creatureType', atLeast: 16 };
    case 'round': return { kind, atLeast: 2 };
    case 'param': return { kind, name: 'types', includesTargetTag: true };
  }
}

export function ConditionEditor({ value, onChange, onRemove, depth = 0 }: { value: Condition; onChange: (c: Condition) => void; onRemove?: () => void; depth?: number }) {
  const tags = useStore((s) => s.library.tags);
  const abilities = useStore((s) => s.library.abilities);
  const abilityList = Object.values(abilities).sort((a, b) => a.name.localeCompare(b.name));
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch } as Condition);

  const num = (key: string, v: number | undefined, placeholder?: string) => (
    <input className={inputCls + ' w-24'} inputMode="numeric" placeholder={placeholder} value={v ?? ''} onChange={(e) => set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })} />
  );
  const text = (key: string, v: string | undefined, placeholder?: string, list?: string) => (
    <input className={inputCls} list={list} placeholder={placeholder} value={v ?? ''} onChange={(e) => set({ [key]: e.target.value })} />
  );
  const enumChips = <T extends string>(key: string, current: T | undefined, options: readonly T[], label?: (o: T) => string) => (
    <div className="flex flex-wrap gap-1">{options.map((o) => <Chip key={o} active={current === o} onClick={() => set({ [key]: o })}>{label ? label(o) : o}</Chip>)}</div>
  );
  const tagPick = (key: string, current: string | undefined, categories?: string[]) => <TagSelect value={current ?? ''} onChange={(v) => set({ [key]: v })} categories={categories} />;

  let body: React.ReactNode = null;
  switch (value.kind) {
    case 'all': case 'any':
      body = (
        <div className="space-y-2">
          {value.of.map((c, i) => <ConditionEditor key={i} value={c} depth={depth + 1} onChange={(n) => set({ of: value.of.map((x, j) => (j === i ? n : x)) })} onRemove={() => set({ of: value.of.filter((_, j) => j !== i) })} />)}
          <button type="button" className="text-sm text-amber-300" onClick={() => set({ of: [...value.of, { kind: 'always' }] })}>+ add condition</button>
        </div>
      );
      break;
    case 'not': body = <ConditionEditor value={value.of} depth={depth + 1} onChange={(n) => set({ of: n })} />; break;
    case 'target.hasTag': body = tagPick('tag', value.tag); break;
    case 'target.tagIn': body = (
      <div>
        <div className="mb-1 flex flex-wrap gap-1">{value.tags.map((t) => <Chip key={t} active onClick={() => set({ tags: value.tags.filter((x) => x !== t) })}>{tags[t]?.label ?? t} ✕</Chip>)}</div>
        <TagSelect value="" placeholder="+ add tag…" onChange={(v) => v && !value.tags.includes(v) && set({ tags: [...value.tags, v] })} />
      </div>
    ); break;
    case 'target.sizeAtLeast': body = enumChips<Size>('size', value.size, ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan', 'colossal']); break;
    case 'target.hurtAtMost': body = enumChips<Hurt>('hurt', value.hurt, ['scratched', 'bloodied', 'nearDeath'], (h) => ({ unhurt: 'unhurt', scratched: 'scratched', bloodied: 'bloodied (below ~50%)', nearDeath: 'near death' }[h])); break;
    case 'target.hasCondition': body = tagPick('condition', value.condition, ['condition', 'custom']); break;
    case 'self.hasCondition': body = tagPick('condition', value.condition, ['condition', 'custom']); break;
    case 'self.hasBuff': case 'self.abilityEnabled': body = (
      <select className={inputCls} value={value.abilityId} onChange={(e) => set({ abilityId: e.target.value })}><option value="">— pick ability —</option>{abilityList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
    ); break;
    case 'attack.kind': body = enumChips('attackKind', value.attackKind, ['ranged', 'melee'] as const); break;
    case 'attack.withinFeet': body = num('feet', value.feet); break;
    case 'attack.index': body = num('index', value.index); break;
    case 'log': body = (
      <div className="space-y-1">
        {enumChips('event', value.event, ['hit', 'miss', 'crit', 'use'] as const)}
        {enumChips('target', value.target ?? 'current', ['current', 'any'] as const, (t) => (t === 'current' ? 'this target' : 'any target'))}
        {enumChips('scope', value.scope, ['thisRound', 'lastRound', 'encounter'] as const, (s) => ({ thisRound: 'this round', lastRound: 'last round', encounter: 'this battle' }[s]))}
        {value.event === 'use' && text('abilityId', value.abilityId, 'ability id')}
        <div className="flex items-center gap-2 text-xs text-zinc-400">at least {num('min', value.min, '1')} times</div>
      </div>
    ); break;
    case 'used': body = (
      <div className="space-y-1">
        <select className={inputCls} value={value.abilityId} onChange={(e) => set({ abilityId: e.target.value })}><option value="">— pick ability —</option>{abilityList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        {enumChips('scope', value.scope, ['round', 'encounter', 'day'] as const)}
        <div className="flex items-center gap-2 text-xs text-zinc-400">per {text('perTagCategory', value.perTagCategory, 'tag category, e.g. creatureType (optional)')}</div>
      </div>
    ); break;
    case 'resource': body = <div className="flex gap-2">{text('id', value.id, 'resource id')}<span className="self-center text-xs text-zinc-400">≥</span>{num('remainingAtLeast', value.remainingAtLeast)}</div>; break;
    case 'toggle': body = text('id', value.id, 'toggle id, e.g. within-30ft or the ability id for declare'); break;
    case 'prompt': body = (
      <div className="space-y-1">{text('id', value.id, 'prompt id, e.g. knowledge')}<div className="flex gap-2">{text('perTagCategory', value.perTagCategory, 'per tag category (optional)')}{num('atLeast', value.atLeast, '≥')}</div></div>
    ); break;
    case 'round': body = <div className="flex gap-2 items-center text-xs text-zinc-400">from {num('atLeast', value.atLeast)} to {num('atMost', value.atMost)}</div>; break;
    case 'param': body = text('name', value.name, 'param name, e.g. types'); break;
    default: body = null;
  }

  return (
    <div className={cx('rounded-xl border p-2', depth % 2 ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-950')}>
      <div className="mb-1 flex items-center gap-2">
        <select className={inputCls + ' flex-1 py-1.5 text-sm'} value={value.kind} onChange={(e) => onChange(defaultFor(e.target.value as Kind))}>
          {GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</optgroup>)}
        </select>
        {onRemove && <button type="button" className="px-2 text-zinc-500" onClick={onRemove}>✕</button>}
      </div>
      {body}
    </div>
  );
}
