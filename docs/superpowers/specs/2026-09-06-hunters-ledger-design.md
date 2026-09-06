# Hunter's Ledger — D&D 3.5e battle assistant (plan)

## Context

Player runs **Memento**, Ranger 5 / Monster Hunter 1 (homebrew prestige class), archer, in a 3.5e game. Combat turns take minutes because of stacked situational bonuses: favored enemies, Knowledge Devotion (bonus depends on a check made once per creature type per fight), Woodland Archer (+4 after a miss on same target this round), Distracting Attack (a hit makes target count as flanked), Memento Aqua (+2/+2 vs aquatic), Monster Blow (1/day, only Monster Killer types, only below 50% HP, declare before roll), trophies (x2 at MH5), haste charges, cursed ring, party auras, and the DM keeps adding more. RPG Scribe can't express any of this beyond free text.

Goal: a phone app where **battle is dumb-simple** (pick target, see final attack/damage numbers with reasons, tap hit/miss, see charges) and **authoring is modular** (feats/items/buffs/monsters/tags as JSON blocks with nested conditions), so Claude can hand the user a JSON pack to import when the DM invents something new.

Source material: `~/Documents/memento character details/` (RPG Scribe XML export, class PDF, two item cards, export-format guide) and `Projects/DnD 3.5e monster lore/Hunters_Bestiary.html` (bestiary with `const MONSTERS = [...]` JSON + lore text).

Decisions made with user:
- Runs on Android as a real app (Capacitor APK), data in app-private storage, JSON export/import for backup and content. Same code runs in browser on mac for authoring.
- Full number computation per attack. Physical dice; DM calls hit/miss; user taps result. Monster AC usually unknown.
- One character now; data model must not block multi-character/multi-player later.
- Round counter only (no initiative). Multi-round effects must be editable/disableable mid-battle.
- Declarative JSON block tree for logic, visual block builder in app, raw JSON view always available.
- Bestiary imported as monster library + lore; "Monster Knowledge" action reveals lore entry on long-press.
- Anything must be moddable in a scenario ad hoc (not just range): generic situational modifiers.
- Log entries editable/deletable after the fact. No cascade recompute (user fixes downstream manually).
- Character sheet tracking in-app: ability scores, saves, AC, skills, feats, resources, full HP tracker (current/max/temp/nonlethal, damage/heal buttons, logged).
- Level-up as a ledger, not a wizard: per-level records, XP, class tables for Ranger + Monster Hunter as data, derived BAB/saves/leftover skill points. No prerequisite validation.

## Project location and stack

- Repo: `/Users/zeanswer/Claude/Projects/DnD/` (empty dir user created). Sibling empty dirs `character/` and `manager/` are mkdir spillover, user can delete.
- npm workspaces monorepo:
  ```
  DnD/
    package.json                # workspaces: packages/*
    packages/engine/            # pure TS rules engine, zero UI deps, vitest
    packages/app/               # Vite + React 18 + TS + Tailwind, Capacitor Android
    packs/                      # authored JSON content (source of truth): core-3.5e.json, memento.json, bestiary.json
    tools/                      # node scripts: bestiary-extract.ts, rpgscribe-import.ts, pack-validate.ts
    docs/superpowers/specs/2026-09-06-hunters-ledger-design.md
  ```
- State: Zustand + immer. Validation: zod schemas in engine (shared by import, builder, tests).
- Storage: `StorageAdapter { load(key), save(key, doc), list(), exportPack(), importPack() }`. Web impl = IndexedDB (`idb-keyval`). Android impl = `@capacitor/filesystem` Directory.Data, one JSON file per document collection. Autosave debounced 300ms. Manual "Backup now" writes timestamped pack to Documents via `@capacitor/share`.
- Capacitor 6 + Android Studio, debug APK sideloaded. No Play Store.

## Design

### 1. Data model (all JSON, stable `id`, `version` on packs)

```ts
Ability {                       // feats, item powers, class features, spells, buffs, memories, situational mods
  id, name, source: 'feat'|'item'|'class'|'spell'|'buff'|'memory'|'situational', text?, sourceRef?
  params?: Record<string, ParamDef>      // e.g. favoredEnemy: {kind:'tag', category:'creatureType', count:2}
  activation: 'passive'|'toggle'|'declare'|{ action: 'standard'|'move'|'full'|'swift'|'free' }
  resources?: [{ id, max: number|Expr, per: 'day'|'encounter'|'round' }]
  duration?: { rounds: number } | 'untilRemoved' | 'endOfNextTurn'
  effects: [{ id, label?, when?: Condition, do: Effect[] }]
  enabledByDefault: boolean
}
Tag { id, label, category: 'creatureType'|'subtype'|'size'|'habitat'|'custom', parent? }   // 'red', 'aquatic', 'aberration'
Monster { id, name, tags: tagId[], size, cr?, senses?, lore?: LoreEntry, notes?, bestiaryId? }
Character {
  id, name, abilityScores, size, xp,
  classLevels: [{ classId, level }],                       // BAB/saves/skill points derived from ClassTable
  hp: { max, current, temp, nonlethal },
  skills: Record<skillId, { ranks, classSkillOverride? }>,
  attackProfiles: [{ id, name, kind:'ranged'|'melee', baseDice, enhancement, critRange, critMult, rangeIncrement, abilityMod:'str'|'dex' }],
  abilities: [{ abilityId, enabled, paramValues }],       // instance = library ability + selections
  resourceState: Record<resourceId, { used: number }>,    // per-day counters persist across battles
  levelHistory: [{ level, classId, hpRolled, skillPointsGained, skillPointsSpent: Record<skillId, n>, featsTaken: abilityId[], notes }]
}
ClassTable { id, name, hitDie, skillPointsPerLevel, classSkills: skillId[], babProgression: 'full'|'3/4'|'1/2', saves: { fort, ref, will: 'good'|'poor' }, levelFeatures: Record<level, abilityId[]> }   // Ranger + Monster Hunter in core/memento packs
Skill { id, name, ability: 'str'|..., trainedOnly?, armorCheck? }
XpTable = standard 3.5e thresholds (data in core pack)
Pack { id, name, version, tags?, abilities?, monsters?, characters? }   // import merges by id; newer version wins, conflicts listed
```

Battle:
```ts
Combatant { id, monsterId?, name, tags: tagId[], size, hurt: 'unhurt'|'scratched'|'bloodied'|'nearDeath', conditions: tagId[], dead, revealed: boolean, notes }
Battle {
  id, name, startedAt, round,
  combatants: Combatant[],
  activeBuffs: [{ instanceId, abilityId, owner:'self'|combatantId, remainingRounds?, suppressed }],
  suppressedAbilities: abilityId[],         // anti-magic etc.
  toggles: Record<toggleId, boolean>,        // "in bard aura", "flanking", "sniping"
  encounterResources: Record<resourceId, used>,
  prompts: Record<string, value>,            // Knowledge Devotion result per creature type
  log: LogEvent[]
}
LogEvent { id, round, seq, kind: 'roundStart'|'attack'|'use'|'tag'|'buff'|'note', actor, targetId?, profileId?, attackIndex?, result?: 'hit'|'miss'|'crit', damage?, notes?, editedAt? }
```
Log is the source of truth. Feat conditions are queries over it. Edit/delete of any event allowed; engine always reads current log.

### 2. Rules engine (`packages/engine`)

Condition tree: `{ all: [] } | { any: [] } | { not: c } | leaf`. Leaves (v1):
- `target.hasTag`, `target.tagIn`, `target.sizeAtLeast`, `target.hurtAtMost`, `target.hasCondition`
- `self.hasBuff`, `self.hasCondition`, `self.abilityEnabled`
- `attack.kind`, `attack.withinFeet` (needs distance prompt or toggle), `attack.isFirstThisRound`, `attack.index`
- `log.hit` / `log.missed` `{ target: 'current'|'any', scope: 'thisRound'|'lastRound'|'encounter' }`
- `used.thisEncounter(abilityId, perTagCategory?)`, `resource.remaining(resourceId) > n`
- `toggle(id)` manual declare, `prompt(id)` value present, `round.atLeast`, `param.includes(paramName, target.tags)` (favored enemy)
Each leaf = one function in `conditions/*.ts` + one builder entry. Adding a leaf is the only code change content ever needs.

Effects (v1): `bonus { to: 'attack'|'damage'|'ac'|'save.fort'|'save.ref'|'save.will'|'skill.<id>'|'init'|'critRange'|'critMult', value: number|Expr, bonusType: 'untyped'|'enhancement'|'insight'|'morale'|'competence'|'circumstance'|'dodge'|'luck'|..., attackKind?: 'ranged'|'melee' }`, `extraDice { dice: '2d6', damageType?, label }`, `ignoreConcealment`, `applyTag { to: 'target'|'self', tag, duration }`, `consume { resourceId }`, `note { text }`, `promptTable { promptId, table: [[maxResult, value]...], apply: bonus... }`, `suppress { abilityId }`.
`Expr` = tiny expression language: numbers, `wisMod`, `mhLevel`, `classLevel(x)`, `prompt(id)`, `trophyMultiplier`, `+ - * floor min max`.

`resolveAttack(ctx)` → `{ attackBonus, breakdown[], damage: { dice[], flat, breakdown[] }, critRange, critMult, notes[], applied[], nearMiss[], warnings[] }`. Stacking: same non-untyped bonus type takes max; untyped/dodge/circumstance stack. Iterative attacks from BAB, Rapid Shot/Manyshot/full attack are ordinary abilities in core pack producing "attack sequences"; engine hardcodes only BAB iteratives and ability mod math.
`resolveStat(ctx, stat)` → same breakdown shape for any stat: `ac`, `save.*`, `skill.*`, `init`, `hp.max`. `resolveAttack` is `resolveStat` for attack/damage plus attack-sequence logic. Character screen and battle share one evaluator.
`derivedFromLevels(character, classTables)` → BAB, base saves, total skill points, leftover skill points, next XP threshold, per-level feature list. Pure function over `levelHistory` + `ClassTable`.
`availableActions(ctx)` → list of declare/action abilities with usable flag + reason (charges left, target eligibility).
`nearMiss[]` = effects whose condition failed, with the failing leaf named ("+4 if target flanked"). Battle UI shows greyed.

### 3. Battle screen (mobile-first, one-thumb)

- Header: round, Next Round (ticks buff durations, resets per-round resources, logs roundStart), resource pills.
- Roster: combatant cards (name, tag chips, hurt pill, condition chips, dead). Tap = target. Long-press = detail sheet (edit tags/hurt/conditions, lore if revealed). Quick-add: name + creature type + size + tags; or pick from bestiary.
- Attack panel: declare toggles row (Monster Blow, in aura, flanking, sniping, custom); attack mode rows (Full Attack, Rapid Shot, Manyshot, Single, Melee) showing per-attack final bonus and damage expression; expand = breakdown + near-miss list. Per attack: Hit / Miss / Crit buttons log and re-resolve next attack immediately.
- Situational modifier: "+ mod" button anywhere: target(self/combatant/all), what (attack/damage/ac/save/skill/tag/suppress ability), value, duration, label. Stored in battle as `source:'situational'` ability; "save to library" promotes it.
- Buffs drawer: active buffs, remaining rounds editable, suppress toggle, add from library.
- Log tab: chronological, edit fields, delete, undo last.
- Actions list: usable abilities with cost/charges and eligibility reason.

### 3b. Character screen

- Top: HP tracker (current / max, temp, nonlethal) with Damage / Heal / Temp buttons (number pad sheet). Every change logged (battle log if battle open, else character history).
- Stat grid: ability scores + mods, AC (with touch/flat-footed), saves, initiative, BAB, speed. Tap any = breakdown from `resolveStat` (same UI as attack breakdown).
- Skills list: ranks, ability mod, misc bonuses from abilities, total; class skill marker; leftover skill points badge.
- Feats/abilities list: enabled toggle, resources with "Long rest" reset button.
- Level ledger: XP with next-threshold bar; per-level rows (class, HP rolled, skill points spent/leftover, feats). "Add level" form: pick class, enter HP roll, assign skill points, pick feats from library. Derived BAB/saves update. No prerequisite checks.

### 4. Library + builder

- Library screens: Abilities, Tags, Monsters, Character. Search, enable/disable, edit, duplicate, delete.
- Block builder: ability form (name, source, activation, resources, duration) + effects list. Each effect: condition tree editor (nested cards: All/Any/Not, leaf picker with typed fields) + effect list (typed forms). Raw JSON tab with live zod validation, round-trips 1:1 with builder.
- Import: pick `.json` pack file, preview diff (new/updated/conflict), merge. Export: whole library, selection, or single ability; character export; full backup.
- Optional `tools/rpgscribe-import.ts`: XML → Character skeleton (scores, levels, ad-hoc feat names, items, daily actions) to seed once. Not a runtime feature.

### 5. Bestiary integration

- `tools/bestiary-extract.ts`: parse `const MONSTERS = ` array from `Hunters_Bestiary.html` → `packs/bestiary.json` (Monster docs: tags from type/subtype/size, cr, senses, lore text sections). Images skipped v1 (size); later via Capacitor assets.
- In-battle: pick from bestiary when adding combatant. Long-press → lore sheet only if `revealed` (set by "Monster Knowledge" action ability in memento pack, or already-recorded entries flagged per Vaelor's manual list, or manual toggle).
- Vaelor's manual abilities authored as Abilities: Monster Knowledge (standard action, prompt Knowledge result ≥16 → reveal), Hunter's Analysis (full round → buff next round: critRange x2 or DR/SR note), Hunter's Instinct (+1 knowledge).

### 6. Content packs (authored JSON)

- `core-3.5e.json`: skills list, XP table, Ranger ClassTable, creature type/subtype/size tags, Point Blank Shot, Precise Shot, Rapid Shot, Manyshot, Weapon Focus, Favored Enemy (param), Improved Initiative, Haste, Bless, common conditions (flanked, prone, stunned, concealment, invisible…), aquatic/habitat tags.
- `memento.json`: Memento character (scores 12/16/12/16/16/11, 44 HP, XP 16088, Ranger 5 + MH 1, skill ranks from export, levelHistory from export `lv_up_history`); Monster Hunter ClassTable (d?, skill points, level features 1-10 from export) and custom skills Knowledge (Monsters), Craft (Taxidermy/Trophy); Woodland Archer (3 effects: Adjust for Range as log.missed thisRound +4 untyped ranged; Pierce the Foliage as ignoreConcealment when log.hit lastRound + prompt; Moving Sniper as note), Knowledge Devotion (promptTable per creature type, insight bonus), Distracting Attack (applyTag flanked on hit until end of next turn), Memento Aqua (+2/+2 vs `aquatic`, swim +2), Memento Formido (+2 will vs favored/Monster Killer), 2nd Favored Enemy, Monster Killer (3 types param), Monster Blow (declare, resource 1/day, target.hurtAtMost nearDeath-or-bloodied warning, tags in Monster Killer), Trophy Crafting bonuses with `trophyMultiplier`, Monster Lore, Monster Horror (future), items (Boots of Speed haste 10 rounds/day, Bracers of Archery +1 attack ranged competence, Chuul gloves +4 init, belt of str, ring prot, cursed Ring of Swimming), Whistle (1/day note), Vaelor's Manual abilities, weapon profile from export (uuid B1029F6A, +1 enhancement).
- Numbers needing user confirmation (bow type, BAB, Monster Killer picks, favored enemy types, current trophies worn) flagged in pack `todo` field; ask user once at content phase, not now.

### 7. Testing

- Engine: vitest, TDD. Fixture = Memento vs sample combatants. Cases: stacking rules; Woodland Archer +4 only after miss, same target, same round, ranged; Knowledge Devotion once per type per encounter; Distracting Attack flanked tag expiry; favored enemy param matching; Monster Blow eligibility + charge consumption + per-day persistence across battles; haste rounds tick; `resolveStat` for AC/saves/skills with typed stacking; `derivedFromLevels` BAB/saves/leftover skill points for Ranger 5 + MH 1 and after adding MH 2; HP damage/heal/temp/nonlethal math; suppressed ability yields nothing; nearMiss reporting; log edit changes subsequent resolution; pack merge/conflict; zod rejects malformed packs; round-trip builder JSON.
- App: Playwright smoke on web build (add combatant → attack → miss → next attack shows +4 → export → import). Manual on-device checklist per phase.

## Phases (each ends with tests green + demo)

**Phase 0 — Scaffold** (`DnD/`): npm workspaces, engine + app packages, Tailwind, vitest, eslint/prettier, git init, spec doc committed at `docs/superpowers/specs/2026-09-06-hunters-ledger-design.md` (this design, expanded). Verify: `npm test`, `npm run dev` blank app.

**Phase 1 — Engine core**: zod schemas, Condition/Effect evaluators, Expr, stacking, `resolveStat`/`resolveAttack`, `derivedFromLevels`, HP math, `availableActions`, log queries, resources, buff ticking, pack merge. Verify: full vitest suite incl. Memento fixture scenarios above.

**Phase 2 — Storage + packs**: StorageAdapter (web IndexedDB), store slices (library, character, battle), pack import/export UI (file picker/download), `core-3.5e.json` + first `memento.json` (with `todo` flags), `tools/pack-validate.ts`. Verify: import memento pack in browser, reload keeps data, export equals import.

**Phase 3 — Battle screen MVP**: roster, quick-add, target select, attack panel with breakdown/near-miss, hit/miss/crit logging, round advance, resources pills, buffs drawer, situational modifier, log tab with edit/delete/undo. Verify: Playwright smoke; manual table-scenario walkthrough (gargoyle fight: Knowledge check, miss then +4, Monster Blow charge).

**Phase 3b — Character screen**: HP tracker, stat grid with breakdowns, skills list, abilities/resources with Long rest. Level ledger deferred to Phase 7. Verify: take 10 damage in battle → log entry + HP; tap Will save → shows +2 Formido only when target is favored enemy.

**Phase 4 — Android**: Capacitor init, Filesystem storage adapter, Share-based backup export, file import via `@capacitor/filesystem` + document picker, build debug APK, install on user's phone. Verify: kill app / reboot → data intact; clear Chrome data → unaffected; backup file opens on mac.

**Phase 5 — Library + block builder**: library screens, ability builder (condition tree + effects + raw JSON), tag/monster/character editors, promote situational mod to library. Verify: build Woodland Archer from scratch in builder, JSON equals pack version; edit on phone.

**Phase 6 — Bestiary + Vaelor's manual**: extraction tool → `bestiary.json`, bestiary picker, revealed/lore sheet, Monster Knowledge / Hunter's Analysis abilities. Verify: add Gargoyle from bestiary, use Monster Knowledge, long-press shows lore.

**Phase 7 — Level ledger + polish**: XP bar, per-level records, "Add level" form, derived BAB/saves/leftover skill points; RPG Scribe import tool (seeds levelHistory from `lv_up_history`), dark theme for table, large tap targets, battle history list, PDF parse of class doc (install poppler) to double-check Monster Hunter class table. Verify: add MH level 2 → BAB, saves, skill points, Monster Lore feature appear.

Later (not planned now): guided level-up wizard with prerequisites, multi-character, party sync/other players (data model already per-character + per-battle documents, so a sync layer can be added), initiative order, in-app dice.

## Verification (end-to-end)

1. `npm test` in repo root: engine suite green.
2. `npm run dev` → browser: import `packs/memento.json`, start battle, add "Gargoyle A" (monstrous humanoid, Large), select, Full Attack shows iteratives with favored-enemy and Knowledge Devotion prompt; tap Miss on attack 1 → attack 2 shows +4 Woodland Archer with reason; declare Monster Blow → warning if hurt not below 50%, charge pill decrements on use; Next Round clears +4; export backup JSON re-imports clean.
3. Android: `npx cap sync android && npx cap open android` → build debug APK → install → repeat scenario on phone; force-stop app → state intact.

## Open items to confirm during Phase 2 content authoring (not blocking)

Bow type/enhancement, Monster Killer type selections, favored enemy types (two UUID params in export unresolved), trophies currently worn, Boots of Speed remaining charges reset policy, Monster Hunter hit die / skill points / BAB progression (from PDF once readable), system feat UUIDs in export (names needed: 1109FFDC, 3A4A00BD, 4DEAF3B6, B186BA2D) — likely Point Blank Shot, Rapid Shot, Track, Weapon Focus, ask user.
