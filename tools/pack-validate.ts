/**
 * Validates every packs/*.json: schema, cross-references (abilities, tags, skills, classes),
 * and that every expression evaluates for each character. Run: npm run validate-packs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PackSchema, emptyLibrary, mergePack, evalExpr, exprVars, resolveStat, resolveAttack, listAttackModes, attackProfiles, type EvalContext, type Pack } from '../packages/engine/src';

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

const checkSelector = (owner: string, sel: string) => {
  const p = sel.split('.');
  if (p[0] === 'target' && (p[1] === 'tag' || p[1] === 'condition') && !lib.tags[p.slice(2).join('.')]) problems.push(`${owner}: unknown tag in selector "${sel}"`);
  if (p[0] === 'self' && p[1] === 'tag' && !lib.tags[p.slice(2).join('.')]) problems.push(`${owner}: unknown tag in selector "${sel}"`);
  if (p[0] === 'self' && p[1] === 'skill' && !lib.skills[p.slice(2, -1).join('.')]) problems.push(`${owner}: unknown skill in selector "${sel}"`);
  if (p[0] === 'self' && p[1] === 'ability' && !lib.abilities[p.slice(2, -1).join('.')]) problems.push(`${owner}: unknown ability in selector "${sel}"`);
  if (p[0] === 'self' && p[1] === 'class' && !lib.classTables[p.slice(2, -1).join('.')]) problems.push(`${owner}: unknown class in selector "${sel}"`);
};
for (const a of Object.values(lib.abilities)) {
  const walk = (c: unknown): void => {
    if (!c || typeof c !== 'object') return;
    const o = c as Record<string, unknown>;
    for (const k of ['is', 'exists', 'compare', 'in']) if (typeof o[k] === 'string') checkSelector(`ability ${a.id}`, o[k] as string);
    if (Array.isArray(o.set)) for (const t of o.set as string[]) if (!lib.tags[t]) problems.push(`ability ${a.id}: unknown tag "${t}"`);
    for (const k of ['all', 'any', 'none', 'count']) if (Array.isArray(o[k])) (o[k] as unknown[]).forEach(walk);
    if (o.not) walk(o.not);
  };
  for (const b of a.effects) {
    walk(b.when);
    for (const e of b.do) {
      if (e.verb === 'modify' && e.to.startsWith('skill.') && !lib.skills[e.to.slice(6)]) problems.push(`ability ${a.id}: unknown skill "${e.to}"`);
      if (e.verb === 'tag' && !lib.tags[e.tag]) problems.push(`ability ${a.id}: tag verb unknown tag "${e.tag}"`);
      if ((e.verb === 'grant' || e.verb === 'suppress') && !lib.abilities[e.ability]) problems.push(`ability ${a.id}: ${e.verb} unknown ability "${e.ability}"`);
    }
  }
  for (const g of a.grants) if (!lib.abilities[g]) problems.push(`ability ${a.id}: grants unknown ability "${g}"`);
  for (const c of a.cost) if (c.kind === 'charge' && !a.resources.some((r) => r.id === c.resourceId) && !Object.values(lib.abilities).some((x) => x.resources.some((r) => r.id === c.resourceId))) problems.push(`ability ${a.id}: charge cost unknown resource "${c.resourceId}"`);
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
    for (const r of a.resources) { try { evalExpr(r.max, vars); } catch (e) { problems.push(`${a.id} resource ${r.id}: ${(e as Error).message}`); } }
    for (const b of a.effects) for (const e of b.do) if (e.verb === 'modify' && typeof e.value === 'string') { try { evalExpr(e.value, vars); } catch (err) { problems.push(`${a.id}/${b.id}: ${(err as Error).message}`); } }
  }
  // smoke: every stat and attack mode resolves
  for (const stat of ['ac', 'ac.touch', 'ac.flatFooted', 'save.fort', 'save.ref', 'save.will', 'init', ...Object.keys(ch.skills).map((s) => `skill.${s}`)]) {
    const r = resolveStat(ctx, stat);
    for (const w of r.warnings) problems.push(`character ${ch.id} ${stat}: ${w}`);
  }
  for (const p of attackProfiles(ctx)) for (const m of listAttackModes(ctx, p.id)) {
    const r = resolveAttack(ctx, { profileId: p.id, modeId: m.modeId });
    console.log(`  ${ch.name} ${p.name} / ${m.label}: ${r.attacks.map((a) => `+${a.attackBonus}`).join('/')}  dmg ${r.attacks[0]?.damage.dice.map((d) => d.dice).join('+')}+${r.attacks[0]?.damage.flat}`);
  }
}

if (problems.length) { console.error('\nPROBLEMS:\n' + problems.map((p) => ' - ' + p).join('\n')); process.exit(1); }
console.log(`\nOK: ${Object.keys(lib.abilities).length} abilities, ${Object.keys(lib.tags).length} tags, ${Object.keys(lib.skills).length} skills, ${Object.keys(monsters).length} monsters, ${Object.keys(characters).length} characters`);
