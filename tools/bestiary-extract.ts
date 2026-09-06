/**
 * Extracts the bestiary from the Hunter's Bestiary HTML (const MONSTERS = [...]) into packs/bestiary.json.
 * Run: npx tsx tools/bestiary-extract.ts [path-to-Hunters_Bestiary.html]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PackSchema, type Pack } from '../packages/engine/src/schema';

const src = process.argv[2] ?? '/Users/zeanswer/Claude/Projects/DnD 3.5e monster lore/Hunters_Bestiary.html';
const html = readFileSync(src, 'utf8');
const i = html.indexOf('const MONSTERS = ');
const start = html.indexOf('[', i);
let depth = 0, end = start;
for (let j = start; j < html.length; j++) {
  const c = html[j];
  if (c === '[') depth++;
  else if (c === ']' && --depth === 0) { end = j + 1; break; }
}
type Raw = {
  id: string; name: string; type: string; unique?: boolean; tags?: string[]; lore?: string; crNum?: number; sizeBase?: string;
  assess?: Record<string, string>; fights?: string; notes?: string[]; threat?: string; threatNote?: string;
  parley?: { stance?: string; text?: string }; srd?: [string, string][]; srdSpecials?: { name: string; text: string }[];
  ages?: string; srdAges?: { age: string; rows: [string, string][] }[];
};
const raw: Raw[] = JSON.parse(html.slice(start, end));

const slug = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const KNOWN_SUBTYPES = new Set(['air', 'earth', 'fire', 'water', 'cold', 'evil', 'good', 'chaotic', 'lawful', 'incorporeal', 'shapechanger', 'swarm', 'extraplanar', 'native', 'augmented', 'reptilian', 'goblinoid', 'elf', 'dwarf', 'human', 'orc', 'gnome', 'halfling', 'aquatic']);
const customTags = new Map<string, string>();

const monsters = raw.map((m) => {
  const type = slug(m.type);
  const sizeType = m.srd?.find((r) => r[0] === 'Size/Type')?.[1] ?? '';
  const subtypes = (/\(([^)]+)\)/.exec(sizeType)?.[1] ?? '').split(',').map((s) => slug(s.trim())).filter(Boolean);
  const tags = new Set<string>([type]);
  for (const s of subtypes) if (KNOWN_SUBTYPES.has(s)) tags.add(s);
  const env = m.srd?.find((r) => r[0] === 'Environment')?.[1]?.toLowerCase() ?? '';
  if (/aquatic|marsh|swamp|underwater|ocean|lake/.test(env) || subtypes.includes('aquatic')) tags.add('aquatic');
  if (/underground/.test(env)) tags.add('subterranean');
  if (/forest/.test(env)) tags.add('forest');
  if (/marsh|swamp/.test(env)) tags.add('swamp');
  if (/desert/.test(env)) tags.add('desert');
  if (/mountain|hill/.test(env)) tags.add('mountain');
  if (/fly \d/.test(m.srd?.find((r) => r[0] === 'Speed')?.[1] ?? '')) tags.add('flying');
  for (const t of m.tags ?? []) { const id = `b-${slug(t)}`; customTags.set(id, t); tags.add(id); }
  if (['huge', 'gargantuan', 'colossal'].includes((m.sizeBase ?? '').toLowerCase())) tags.add('oversized');
  const sq = m.srd?.find((r) => r[0] === 'Special Qualities')?.[1] ?? '';
  const senses = sq.split(/,\s*/).filter((s) => /darkvision|blindsight|blindsense|tremorsense|low-light|scent|true seeing/i.test(s)).join(', ');
  const sections: { title: string; body: string }[] = [];
  if (m.assess) sections.push({ title: "Hunter's assessment", body: Object.entries(m.assess).map(([k, v]) => `${k[0]!.toUpperCase()}${k.slice(1)}: ${v}`).join('\n') });
  if (m.fights) sections.push({ title: 'How it fights', body: m.fights });
  if (m.notes?.length) sections.push({ title: 'Margin notes', body: m.notes.map((n) => `• ${n}`).join('\n') });
  if (m.parley?.text) sections.push({ title: `Parley (${m.parley.stance ?? '?'})`, body: m.parley.text });
  if (m.threat) sections.push({ title: 'Threat', body: `${m.threat}${m.threatNote ? ` — ${m.threatNote}` : ''}` });
  if (m.srd?.length) sections.push({ title: 'Stat block (SRD)', body: m.srd.map(([k, v]) => `${k}: ${v}`).join('\n') });
  if (m.srdSpecials?.length) sections.push({ title: 'Special abilities', body: m.srdSpecials.map((s) => `${s.name}: ${s.text}`).join('\n\n') });
  if (typeof m.ages === 'string') sections.push({ title: 'Ages', body: m.ages });
  if (Array.isArray(m.srdAges)) sections.push({ title: 'By age (SRD)', body: m.srdAges.map((a) => `${a.age}: ${a.rows.map(([k, v]) => `${k} ${v}`).join('; ')}`).join('\n\n') });
  return {
    id: `bestiary-${m.id}`, name: m.name, tags: [...tags], size: (m.sizeBase ?? 'medium').toLowerCase(),
    ...(m.crNum !== undefined ? { cr: m.crNum } : {}), ...(senses ? { senses } : {}),
    lore: { ...(m.lore ? { summary: m.lore } : {}), sections }, bestiaryId: m.id,
  };
});

const pack: Pack = PackSchema.parse({
  id: 'bestiary', name: "Hunter's Bestiary", version: 1,
  description: "Monsters and lore from Vaelor's bestiary project.",
  tags: [...customTags.entries()].map(([id, label]) => ({ id, label, category: 'custom' })),
  monsters,
});
writeFileSync(new URL('../packs/bestiary.json', import.meta.url), JSON.stringify(pack, null, 2) + '\n');
console.log(`bestiary: ${monsters.length} monsters, ${customTags.size} descriptive tags`);
