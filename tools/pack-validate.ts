/**
 * Validates every packs/*.json: schema, cross-references (abilities, tags, skills, classes),
 * and that every expression evaluates for each character. Run: npm run validate-packs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PackSchema, emptyLibrary, mergePack, evalExpr, exprVars, resolveStat, resolveAttack, listAttackModes, type EvalContext, type Pack } from '../packages/engine/src';

const dir = new URL('../packs/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const problems: string[] = [];
let lib = emptyLibrary();
const packs: Pack[] = [];

for (const f of files) {
  const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const r = PackSchema.safeParse(raw);
  if (!r.success) { problems.push(`${f}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`); continue; }
  packs.push(r.data);
  const m = mergePack(lib, r.data);
  lib = m.library;
  for (const c of m.report.conflicts) problems.push(`${f}: conflict ${c.key} (already from ${c.existingPack})`);
  console.log(`${f}: +${m.report.added.length} added, ${m.report.updated.length} updated, ${m.report.conflicts.length} conflicts`);
}

const monsters = (lib as { monsters?: Record<string, unknown> }).monsters ?? {};
const characters = (lib as { characters?: Record<string, Pack['characters'][number]> }).characters ?? {};

const statIds = (a: Pack['abilities'][number]) => a.effects.flatMap((b) => b.do.flatMap((e) => ('to' in e ? [e.to] : [])));
for (const a of Object.values(lib.abilities)) {
  for (const s of statIds(a)) if (s.startsWith('skill.') && !lib.skills[s.slice(6)]) problems.push(`ability ${a.id}: unknown skill "${s}"`);
  const walk = (c: unknown): void => {
    if (!c || typeof c !== 'object') return;
    const o = c as Record<string, unknown>;
    if (o.kind === 'target.hasTag' && !lib.tags[o.tag as string]) problems.push(`ability ${a.id}: unknown tag "${o.tag}"`);
    if (o.kind === 'target.hasCondition' && !lib.tags[o.condition as string]) problems.push(`ability ${a.id}: unknown condition tag "${o.condition}"`);
    if (o.kind === 'target.tagIn') for (const t of o.tags as string[]) if (!lib.tags[t]) problems.push(`ability ${a.id}: unknown tag "${t}"`);
    if (Array.isArray(o.of)) o.of.forEach(walk); else if (o.of) walk(o.of);
  };
  for (const b of a.effects) {
    walk(b.when);
    for (const e of b.do) if (e.kind === 'applyTag' && !lib.tags[e.tag]) problems.push(`ability ${a.id}: applyTag unknown tag "${e.tag}"`);
  }
}
for (const m of Object.values(monsters) as { id: string; tags: string[] }[]) for (const t of m.tags) if (!lib.tags[t]) problems.push(`monster ${m.id}: unknown tag "${t}"`);

for (const ch of Object.values(characters)) {
  for (const cl of ch.classLevels) if (!lib.classTables[cl.classId]) problems.push(`character ${ch.id}: unknown class "${cl.classId}"`);
  for (const sk of Object.keys(ch.skills)) if (!lib.skills[sk]) problems.push(`character ${ch.id}: unknown skill "${sk}"`);
  const ctx: EvalContext = { character: ch, library: lib };
  const vars = exprVars(ctx);
  for (const inst of ch.abilities) {
    const a = lib.abilities[inst.abilityId];
    if (!a) { problems.push(`character ${ch.id}: unknown ability "${inst.abilityId}"`); continue; }
    for (const [p, def] of Object.entries(a.params ?? {})) {
      const vals = inst.paramValues[p];
      if (!vals?.length) problems.push(`character ${ch.id}: ${a.id} param "${p}" not chosen`);
      for (const v of vals ?? []) { const t = lib.tags[v]; if (!t) problems.push(`character ${ch.id}: ${a.id} param "${p}" unknown tag "${v}"`); else if (def.category && t.category !== def.category) problems.push(`character ${ch.id}: ${a.id} param "${p}" tag "${v}" is ${t.category}, expected ${def.category}`); }
    }
    for (const r of a.resources ?? []) { try { evalExpr(r.max, vars); } catch (e) { problems.push(`${a.id} resource ${r.id}: ${(e as Error).message}`); } }
    for (const b of a.effects) for (const e of b.do) if ((e.kind === 'bonus') && typeof e.value === 'string') { try { evalExpr(e.value, vars); } catch (err) { problems.push(`${a.id}/${b.id}: ${(err as Error).message}`); } }
  }
  // smoke: every stat and attack mode resolves
  for (const stat of ['ac', 'ac.touch', 'ac.flatFooted', 'save.fort', 'save.ref', 'save.will', 'init', ...Object.keys(ch.skills).map((s) => `skill.${s}`)]) {
    const r = resolveStat(ctx, stat);
    for (const w of r.warnings) problems.push(`character ${ch.id} ${stat}: ${w}`);
  }
  for (const p of ch.attackProfiles) for (const m of listAttackModes(ctx, p.id)) {
    const r = resolveAttack(ctx, { profileId: p.id, modeId: m.modeId });
    console.log(`  ${ch.name} ${p.name} / ${m.label}: ${r.attacks.map((a) => `+${a.attackBonus}`).join('/')}  dmg ${r.attacks[0]?.damage.dice.map((d) => d.dice).join('+')}+${r.attacks[0]?.damage.flat}`);
  }
}

if (problems.length) { console.error('\nPROBLEMS:\n' + problems.map((p) => ' - ' + p).join('\n')); process.exit(1); }
console.log(`\nOK: ${Object.keys(lib.abilities).length} abilities, ${Object.keys(lib.tags).length} tags, ${Object.keys(lib.skills).length} skills, ${Object.keys(monsters).length} monsters, ${Object.keys(characters).length} characters`);
