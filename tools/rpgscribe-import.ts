/**
 * Reads an RPG Scribe (3.5e) XML export and writes tools/data/<name>-rpgscribe.json with the parts
 * Hunter's Ledger can use: ability scores, hp, xp, class levels, skill ranks, level history, daily uses, item names.
 * System UUIDs are mapped through the small tables below; unknown ones are kept as "unknown-<uuid8>" so you can fix them.
 * Run: npx tsx tools/rpgscribe-import.ts "~/Documents/memento character details/memento export.xml"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const SKILLS: Record<string, string> = {
  'AC520731-D903-4ED8-AFAF-EC50014F3803': 'swim', '520FC41A-F2F8-4F43-8DC5-CDCF2BC37EBD': 'climb', '74CB2079': 'jump',
  '742A32C0-B87B-45C2-99B5-BD9AE31707C3': 'hide', 'F5327B33-CBD6-4A68-891F-2877A473AA31': 'spot', '248E2A11-546F-4BCC-B49A-01D58FBE84A7': 'move-silently',
  '17F1C088-2004-46A5-AD24-AB73EA1129BA': 'listen', 'A21B29AA-61CA-4E37-8909-15A65747D5F2': 'survival',
  'D9181213-5097-4F05-973D-2F88C6926248': 'knowledge-monsters', '70238C3D-267E-49C3-9B75-F7126DF26294': 'craft-taxidermy',
};
const CLASSES: Record<string, string> = { 'EBF89531-82D0-42EF-A49C-9285D311AB31': 'ranger', 'B2527FF6-31D0-4BA9-BE1E-5EF07D51A33A': 'monster-hunter' };
const FEATS: Record<string, string> = {
  '4DEAF3B6-D94A-48A3-B4D4-303F5FBC12C0': 'track?', '58229FBA-B23B-4043-8CD4-B2C6207339F4': 'favored-enemy', 'B186BA2D-962A-4453-9E99-99BB2CECF20D': 'weapon-focus?',
  '3A4A00BD-92F0-43AA-86B5-052B5E71BEC4': 'rapid-shot?', '1109FFDC-CCC4-44B5-B85D-BB9BAB8158FD': 'point-blank-shot?',
  'D94454B1-12FB-4674-B895-9DA4689F885E': 'woodland-archer', 'F00BCE10-45D2-4DAD-8078-AE57456A0964': '2nd-favored-enemy', 'FF90CB56-B29E-4C58-B6E4-5E820C0A60E0': 'knowledge-devotion',
};
const map = (t: Record<string, string>, uuid: string) => t[uuid] ?? Object.entries(t).find(([k]) => uuid.startsWith(k))?.[1] ?? `unknown-${uuid.slice(0, 8).toLowerCase()}`;

const file = process.argv[2]?.replace(/^~/, process.env.HOME ?? '') ?? `${process.env.HOME}/Documents/memento character details/memento export.xml`;
let xml = readFileSync(file, 'utf8').replace(/&#(\d+);/g, (m, n) => (Number(n) >= 0xd800 && Number(n) <= 0xdfff ? '?' : m));
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#', isArray: (name) => ['feat_info', 'lh_entry', 'skill', 'inventory_entry', 'daily_action', 'class_level', 'feat', 'character'].includes(name) });
const doc = parser.parse(xml);
const ch = doc.rpgs35_export.characters.character[0].character[0];
const name: string = ch.name;
const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const txt = (x: unknown) => (x && typeof x === 'object' && '#' in (x as object) ? String((x as { '#': unknown })['#']) : x === undefined ? '' : String(x));

const out = {
  name,
  abilityScores: { str: +ch.abilities.ability_0, dex: +ch.abilities.ability_1, con: +ch.abilities.ability_2, int: +ch.abilities.ability_3, wis: +ch.abilities.ability_4, cha: +ch.abilities.ability_5 },
  xp: +ch.exp, level: +ch.level,
  hp: { max: +ch.hp.gained_hp + +(ch.hp.custom_mod ?? 0), current: +ch.hp.gained_hp + +(ch.hp.custom_mod ?? 0) - +(ch.hp.wounds ?? 0) },
  classLevels: arr(ch.class_levels?.class_level).map((c: { class: string; level: string }) => ({ classId: map(CLASSES, c.class), level: +c.level })),
  // RPG Scribe stores half-ranks: 16 = 8 ranks
  skills: Object.fromEntries(arr(ch.skills?.skill).map((s: { '@uuid': string; ranks: string; override_class_skill_flag?: string }) => [map(SKILLS, s['@uuid']), { ranks: +s.ranks / 2, ...(s.override_class_skill_flag === 'TRUE' ? { classSkillOverride: true } : {}) }])),
  levelHistory: arr(ch.lv_up_history?.lh_entry).map((e: { '@level': string; class: string; hit_roll?: string; ability?: string; skill_ranks?: { skill?: unknown }; unusedSkillPoints?: string; feats?: { feat?: unknown } }) => ({
    level: +e['@level'], classId: map(CLASSES, e.class), hpRolled: +(e.hit_roll ?? 0),
    ...(e.ability !== undefined ? { abilityIncrease: (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const)[+e.ability] } : {}),
    skillPointsSpent: Object.fromEntries(arr(e.skill_ranks?.skill as { '@uuid': string; '#': string }[]).map((s) => [map(SKILLS, s['@uuid']), +txt(s) / 2])),
    featsTaken: arr(e.feats?.feat as { id?: string; name?: string }[]).map((f) => f.name ?? map(FEATS, f.id ?? '')),
    ...(e.unusedSkillPoints ? { notes: `${+e.unusedSkillPoints / 2} unspent skill points` } : {}),
  })),
  feats: arr(ch.feats?.std_feats?.feat_info).map((fi: { feat: { '@adhoc'?: string; name?: string; id?: string; parameter?: unknown }[] }) => { const f = arr(fi.feat)[0]!; return f['@adhoc'] === 'TRUE' ? f.name : `${map(FEATS, f.id ?? '')}${f.parameter ? ` (${txt(f.parameter)})` : ''}`; }),
  dailyActions: arr(ch.daily_actions?.daily_action).map((d: { action: { name: string; base_uses: string }; consumed_uses?: string }) => ({ name: d.action.name, max: +d.action.base_uses, used: +(d.consumed_uses ?? 0) })),
  items: arr(ch.inventory?.inventory_items?.inventory_entry).map((ie: { item?: { name?: string; uuid?: string; item_type?: string; enhancement?: string } }) => ie.item?.name ?? `library item ${ie.item?.uuid?.slice(0, 8)} (type ${ie.item?.item_type}${ie.item?.enhancement ? `, +${ie.item.enhancement}` : ''})`),
  notes: arr(ch.snippets?.snippet).map((s: { note?: { title?: string; content?: string } }) => `${s.note?.title}: ${s.note?.content}`),
};
const target = new URL(`./data/${name.toLowerCase()}-rpgscribe.json`, import.meta.url);
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${target.pathname}: level ${out.level}, ${out.levelHistory.length} level records, ${Object.keys(out.skills).length} skills, ${out.feats.length} feats, ${out.items.length} items`);
