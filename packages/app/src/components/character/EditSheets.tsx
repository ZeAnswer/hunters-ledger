import { useMemo, useState } from 'react';
import { CharacterSchema, derivedFromLevels, maxRanks, type AbilityKey, type Character, type EvalContext } from '@hl/engine';
import { useStore } from '../../store/store';
import { Button, Field, Sheet, cx, inputCls } from '../ui';

type Mode = 'regular' | 'override';

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="mb-3 flex gap-1 rounded-xl bg-zinc-950 p-1">
      {(['regular', 'override'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={cx('flex-1 rounded-lg py-1.5 text-sm', mode === m ? 'bg-zinc-700 text-white' : 'text-zinc-400')}>{m === 'regular' ? 'Regular (budgeted)' : 'Override (JSON)'}</button>)}
    </div>
  );
}

/** JSON editor for a slice of the character. `keys` picks which top-level fields are shown; the rest is untouched. */
function JsonOverride({ character, keys, info, onSave }: { character: Character; keys: (keyof Character)[]; info: string[]; onSave: (patch: Partial<Character>) => void }) {
  const slice = Object.fromEntries(keys.map((k) => [k, character[k]]));
  const [json, setJson] = useState(() => JSON.stringify(slice, null, 2));
  const [err, setErr] = useState<string | undefined>();
  const save = () => {
    try {
      const raw = JSON.parse(json);
      const merged = CharacterSchema.parse({ ...character, ...raw });
      onSave(Object.fromEntries(keys.map((k) => [k, merged[k]])) as Partial<Character>);
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div>
      <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400">{info.map((l) => <div key={l}>{l}</div>)}</div>
      <textarea className={inputCls + ' h-[45vh] font-mono text-xs'} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      {err && <pre className="mt-2 whitespace-pre-wrap text-xs text-red-300">{err}</pre>}
      <Button variant="primary" className="mt-2" onClick={save}>Save override</Button>
    </div>
  );
}

function useSave() {
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  return (c: Character, patch: Partial<Character>, text: string) => {
    setCharacter({ ...c, ...patch, journal: [...c.journal, { at: new Date().toISOString(), kind: 'edit', text }] });
    showToast('Saved');
  };
}

// ---------------- Skills ----------------
export function SkillsEditSheet({ ctx, onClose }: { ctx: EvalContext; onClose: () => void }) {
  const save = useSave();
  const [mode, setMode] = useState<Mode>('regular');
  const [skills, setSkills] = useState(ctx.character.skills);
  const [q, setQ] = useState('');
  const draft = useMemo(() => ({ ...ctx.character, skills }), [ctx.character, skills]);
  const d = useMemo(() => derivedFromLevels(draft, ctx.library), [draft, ctx.library]);
  const hasLedger = ctx.character.levelHistory.length > 0;
  const rows = Object.values(ctx.library.skills).filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const set = (id: string, patch: Partial<{ ranks: number; classSkillOverride?: boolean }>) => setSkills({ ...skills, [id]: { ...(skills[id] ?? { ranks: 0 }), ...patch } });
  const changes = Object.keys({ ...skills, ...ctx.character.skills }).filter((id) => (skills[id]?.ranks ?? 0) !== (ctx.character.skills[id]?.ranks ?? 0) || skills[id]?.classSkillOverride !== ctx.character.skills[id]?.classSkillOverride);
  const accept = () => {
    const text = `Skills: ${changes.map((id) => `${ctx.library.skills[id]?.name ?? id} ${ctx.character.skills[id]?.ranks ?? 0}→${skills[id]?.ranks ?? 0}`).join(', ')}`;
    save(ctx.character, { skills }, text);
    onClose();
  };
  const info = [
    `Skill points from levels: ${d.skillPoints.total} (ledger) · spent by current ranks: ${d.skillBudget.spentByRanks} · remaining: ${d.skillBudget.remaining}`,
    `Max ranks at level ${d.level}: ${maxRanks(d.level, true)} class / ${maxRanks(d.level, false)} cross-class. Cross-class ranks cost 2 points each.`,
    'Fields: ranks (may be .5 for cross-class), classSkillOverride (true/false) to force class/cross-class status.',
  ];

  return (
    <Sheet open onClose={onClose} title="Edit skills" tall>
      <ModeToggle mode={mode} setMode={setMode} />
      {mode === 'override' ? (
        <JsonOverride character={draft} keys={['skills', 'extraSkillPointsPerLevel']} info={info} onSave={(p) => { save(ctx.character, p, 'Skills: JSON override'); onClose(); }} />
      ) : (
        <div>
          <div className={cx('mb-2 rounded-xl border p-2 text-sm', d.skillBudget.remaining < 0 ? 'border-red-900 text-red-300' : 'border-zinc-800 text-zinc-300')}>
            {hasLedger ? <>Points remaining: <b>{d.skillBudget.remaining}</b> of {d.skillPoints.total} · max ranks {maxRanks(d.level, true)} / {maxRanks(d.level, false)} cross</> : 'No level ledger yet: no budget, edit freely.'}
          </div>
          <input className={inputCls + ' mb-2'} placeholder="Filter skills…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {rows.map((s) => {
              const ranks = skills[s.id]?.ranks ?? 0;
              const cs = d.isClassSkill(s.id);
              const cost = cs ? 1 : 2;
              const step = cs ? 1 : 0.5;
              const canAdd = !hasLedger || (d.skillBudget.remaining >= cost && ranks + step <= maxRanks(d.level, cs));
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className={cx('truncate', ranks === 0 && 'text-zinc-400')}>{s.name}</div>
                    <button type="button" className={cx('text-[11px]', cs ? 'text-emerald-300' : 'text-zinc-500')} onClick={() => set(s.id, { classSkillOverride: !cs })}>{cs ? 'class skill' : 'cross-class'} · tap to flip</button>
                  </div>
                  <button type="button" className="rounded-lg bg-zinc-800 px-3 py-1 disabled:opacity-30" disabled={ranks <= 0} onClick={() => set(s.id, { ranks: Math.max(0, ranks - step) })}>−</button>
                  <span className="w-8 text-center tabular-nums">{ranks}</span>
                  <button type="button" className="rounded-lg bg-zinc-800 px-3 py-1 disabled:opacity-30" disabled={!canAdd} onClick={() => set(s.id, { ranks: ranks + step })}>+</button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={changes.length === 0} onClick={accept}>Accept ({changes.length} change{changes.length === 1 ? '' : 's'})</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---------------- Stats ----------------
const KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function StatsEditSheet({ ctx, onClose }: { ctx: EvalContext; onClose: () => void }) {
  const save = useSave();
  const [mode, setMode] = useState<Mode>('regular');
  const [draft, setDraft] = useState<Character>(ctx.character);
  const d = useMemo(() => derivedFromLevels(draft, ctx.library), [draft, ctx.library]);
  const hasLedger = ctx.character.levelHistory.length > 0;

  /** +1 to a score consumes an unrecorded level-4/8/12 increase (recorded on the earliest such level). */
  const bump = (k: AbilityKey, dir: 1 | -1) => {
    let history = draft.levelHistory;
    if (hasLedger) {
      if (dir === 1) {
        const idx = history.findIndex((r) => r.level % 4 === 0 && !r.abilityIncrease);
        if (idx < 0) return;
        history = history.map((r, i) => (i === idx ? { ...r, abilityIncrease: k } : r));
      } else {
        const idx = [...history].map((r, i) => ({ r, i })).reverse().find((x) => x.r.abilityIncrease === k)?.i;
        if (idx === undefined) return;
        history = history.map((r, i) => (i === idx ? { ...r, abilityIncrease: undefined } : r));
      }
    }
    setDraft({ ...draft, levelHistory: history, abilityScores: { ...draft.abilityScores, [k]: draft.abilityScores[k] + dir } });
  };
  const num = (label: string, key: 'baseArmor' | 'baseShield' | 'baseNaturalArmor' | 'speed' | 'hpAdjust' | 'xp', step = 1) => (
    <div key={key} className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-1.5 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" className="rounded-lg bg-zinc-800 px-3 py-1" onClick={() => setDraft({ ...draft, [key]: draft[key] - step })}>−</button>
        <input className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-center" inputMode="numeric" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) || 0 })} />
        <button type="button" className="rounded-lg bg-zinc-800 px-3 py-1" onClick={() => setDraft({ ...draft, [key]: draft[key] + step })}>+</button>
      </span>
    </div>
  );
  const changed = JSON.stringify(draft) !== JSON.stringify(ctx.character);
  const accept = () => {
    const diffs: string[] = [];
    for (const k of KEYS) if (draft.abilityScores[k] !== ctx.character.abilityScores[k]) diffs.push(`${k.toUpperCase()} ${ctx.character.abilityScores[k]}→${draft.abilityScores[k]}`);
    for (const k of ['baseArmor', 'baseShield', 'baseNaturalArmor', 'speed', 'hpAdjust', 'xp'] as const) if (draft[k] !== ctx.character[k]) diffs.push(`${k} ${ctx.character[k]}→${draft[k]}`);
    save(ctx.character, { abilityScores: draft.abilityScores, levelHistory: draft.levelHistory, baseArmor: draft.baseArmor, baseShield: draft.baseShield, baseNaturalArmor: draft.baseNaturalArmor, speed: draft.speed, hpAdjust: draft.hpAdjust, xp: draft.xp }, `Stats: ${diffs.join(', ')}`);
    onClose();
  };
  const info = [
    `Level ${d.level}: ability increases earned ${Math.floor(d.level / 4)}, recorded ${Object.values(d.abilityIncreases).reduce((a, b) => a + (b ?? 0), 0)}, unspent ${d.unspentAbilityIncreases}.`,
    `HP: ${d.hpFromLevels !== undefined ? `${d.hpRolledTotal} rolled + Con × ${draft.levelHistory.length} levels = ${d.hpFromLevels}` : `stored max ${draft.hp.max}`}; hpAdjust adds a flat amount (Toughness etc. should be abilities).`,
    'abilityScores are the current totals (racial, level increases and permanent items included). vars feed pack expressions.',
  ];

  return (
    <Sheet open onClose={onClose} title="Edit stats" tall>
      <ModeToggle mode={mode} setMode={setMode} />
      {mode === 'override' ? (
        <JsonOverride character={draft} keys={['abilityScores', 'hp', 'hpAdjust', 'baseArmor', 'baseShield', 'baseNaturalArmor', 'speed', 'xp', 'vars', 'extraSkillPointsPerLevel', 'extraFeatAtFirstLevel', 'classLevels']} info={info} onSave={(p) => { save(ctx.character, p, 'Stats: JSON override'); onClose(); }} />
      ) : (
        <div>
          <Field label={`Ability scores${hasLedger ? ` · unspent level increases: ${d.unspentAbilityIncreases}` : ' (no ledger: free edit)'}`}>
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <div key={k} className="rounded-xl bg-zinc-950 p-2 text-center">
                  <div className="text-[10px] uppercase text-zinc-500">{k}</div>
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" className="rounded-lg bg-zinc-800 px-2 disabled:opacity-30" disabled={hasLedger && !draft.levelHistory.some((r) => r.abilityIncrease === k)} onClick={() => bump(k, -1)}>−</button>
                    <span className="w-8 text-xl font-bold tabular-nums">{draft.abilityScores[k]}</span>
                    <button type="button" className="rounded-lg bg-zinc-800 px-2 disabled:opacity-30" disabled={hasLedger && d.unspentAbilityIncreases === 0} onClick={() => bump(k, 1)}>+</button>
                  </div>
                  {(d.abilityIncreases[k] ?? 0) > 0 && <div className="text-[10px] text-amber-300">+{d.abilityIncreases[k]} from levels</div>}
                </div>
              ))}
            </div>
          </Field>
          <Field label="Other numbers (free)">
            <div className="space-y-1">
              {num('Armor bonus (worn armor)', 'baseArmor')}
              {num('Shield bonus', 'baseShield')}
              {num('Natural armor', 'baseNaturalArmor')}
              {num('Speed', 'speed', 5)}
              {num('Max HP adjustment', 'hpAdjust')}
              {num('XP', 'xp', 100)}
            </div>
          </Field>
          <div className="flex gap-2">
            <Button variant="primary" disabled={!changed} onClick={accept}>Accept</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---------------- Ledger override ----------------
export function LedgerOverrideSheet({ ctx, onClose }: { ctx: EvalContext; onClose: () => void }) {
  const save = useSave();
  const d = derivedFromLevels(ctx.character, ctx.library);
  const info = [
    `Per level: classId, hpRolled, skillPointsSpent {skillId: points}, featsTaken [ability ids], featuresGained, abilityIncrease, notes.`,
    `Derived now: BAB +${d.bab}, HP from levels ${d.hpFromLevels ?? '-'}, skill points ${d.skillPoints.total}, feat slots ${d.featSlots.recorded}/${d.featSlots.expected}.`,
    'classLevels must match the ledger (the app does not recompute it from records).',
  ];
  return (
    <Sheet open onClose={onClose} title="Override level ledger" tall>
      <JsonOverride character={ctx.character} keys={['levelHistory', 'classLevels', 'extraFeatAtFirstLevel', 'extraSkillPointsPerLevel']} info={info} onSave={(p) => { save(ctx.character, p, 'Level ledger: JSON override'); onClose(); }} />
    </Sheet>
  );
}

// ---------------- Whole character ----------------
export function CharacterOverrideSheet({ ctx, onClose }: { ctx: EvalContext; onClose: () => void }) {
  const save = useSave();
  const keys = Object.keys(ctx.character) as (keyof Character)[];
  return (
    <Sheet open onClose={onClose} title="Character JSON" tall>
      <JsonOverride character={ctx.character} keys={keys.filter((k) => k !== 'journal')} info={['Whole character (journal excluded). Validated on save.']} onSave={(p) => { save(ctx.character, p, 'Character: JSON override'); onClose(); }} />
    </Sheet>
  );
}
