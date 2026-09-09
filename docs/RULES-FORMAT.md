# Rules format (v2)

Every feat, class feature, item, spell, buff, condition, memory and situational modifier is one **Ability** JSON document. Content lives in packs (`packs/*.json`); the shape is defined in `packages/engine/src/schema.ts`. Rules written in the older v1 format (`kind`-based) are converted automatically on import.

## Envelope

```jsonc
{
  "id": "monster-blow", "name": "Monster Blow", "text": "…", "sourceRef": "Monster Hunter PDF",
  "origin": "classFeature",            // feat | classFeature | race | item | spell | buff | condition | memory | situational | monster | core
  "binding": "none",                   // none | thisItem | thisWeapon | { "slot": "arms" }
  "activation": "declare",             // passive | toggle | declare | atWill | { "action": "standard" } | { "reaction": "onDamaged" }
  "cost": [{ "kind": "charge", "resourceId": "monster-blow" }],   // charge | gold | xp | hp | item | spellSlot
  "duration": { "rounds": 5 },         // instant | thisAttack | thisTurn | untilMyNextTurn | endOfRound | {rounds} | {minutes} | encounter | untilRemoved | whileActive | concentration
  "resources": [{ "id": "monster-blow", "max": "1 + floor(classLevel(monster-hunter) / 5)", "resetOn": "day", "resetTo": "max" }],
  "params": { "types": { "kind": "tags", "category": "creatureType" } },   // choices the character makes
  "grants": ["hog-daylight"],          // bundled sub-abilities, listed separately in battle with this one as origin
  "item": { "category": "weapon", "slot": "mainHand", "tags": ["bow", "longbow"], "weapon": { "kind": "ranged", "dice": "1d8", "critMult": 3, "rangeIncrement": 110, "attackAbility": "dex", "damageAbility": "str", "maxDamageAbilityBonus": 4, "enhancement": 1 } },
  "effects": [ /* blocks */ ]
}
```

Activation rules of thumb: **passive** = always on; **toggle** = on/off switch (Boots of Speed, stances), effects apply only while on; switching on needs charges but costs nothing, one charge is spent for every round executed (Next round) while it is on, and it switches off when the pool is empty; **declare** = a chip you tap before rolling, cleared each round; **action** = a Use button that logs, pays costs and runs `onUse` blocks; **reaction** = automatic on the named trigger.

Resources: `resetOn` = round | encounter | day | rest | manual | never. `resetTo: max` shows charges left (10/10 baseline); `resetTo: zero` shows a counter that climbs from 0.

## Blocks

```jsonc
{ "id": "adjust", "label": "Adjust for Range",
  "trigger": "always",   // always | onUse | onActivate | onDeactivate | onHit | onMiss | onCrit | onDamaged | onRoundStart | onRoundEnd
  "when": { "all": [ … ] },
  "do": [ … ] }
```

`always` blocks contribute while their condition holds; the other triggers fire once when the event happens (their `do` may tag, grant, consume, heal, reveal).

## Selectors

A selector is a dot path naming a piece of state. The builder shows them as *domain → field → key* dropdowns.

| Selector | Value |
|---|---|
| `self.stat.<stat>` | number: attack, damage, ac, ac.touch, ac.flatFooted, save.fort/ref/will, init, speed, hp.max, critRange, critMult, ability.str…cha, dr, sr, resist.fire…, casterLevel, spellDC |
| `self.skill.<id>.ranks` / `.total` / `.classSkill` | number / number / boolean |
| `self.class.<id>.level`, `self.level`, `self.bab`, `self.hp.current`, `self.hp.max` | number |
| `self.tag.<tag>` | boolean: condition on you |
| `self.ability.<id>.enabled` / `.active` / `.usesLeft` / `.used` | boolean / boolean / number / number |
| `self.resource.<id>.left` / `.used` / `.max` | number |
| `self.equipped.item.<id>` | boolean |
| `self.equipped.slot.<slot>`, `self.equipped.category.<cat>`, `self.equipped.count.tag.<tag>` | number of equipped items |
| `self.param.<name>` | list of chosen tags |
| `self.var.<name>` | number from the character's vars |
| `target.exists`, `target.tag.<tag>`, `target.condition.<tag>`, `target.revealed`, `target.dead` | boolean |
| `target.type`, `target.tags` | creature type tag / all tags |
| `target.size`, `target.hurt` | ordinal (compare with names: `large`, `bloodied`) |
| `target.distance` | feet |
| `attack.exists`, `attack.kind`, `attack.index`, `attack.mode`, `attack.isFirstThisRound` | boolean / ranged\|melee / number / mode id / boolean |
| `attack.weapon.id`, `attack.weapon.category`, `attack.weapon.tag.<tag>` | weapon item id / category / boolean |
| `battle.round`, `battle.toggle.<id>`, `battle.prompt.<id>`, `battle.tag.<tag>` | number / boolean / number / boolean |
| `flag.<name>` | boolean set by `flag` effects (ignoreConcealment, neverFlatFooted, immune.*, sense.*) |

## Conditions

```jsonc
{ "all": [ … ] }  { "any": [ … ] }  { "none": [ … ] }  { "not": … }  { "count": [ … ], "atLeast": 2 }
{ "is": "target.tag.aquatic" }                       // boolean selector is true
{ "exists": "battle.prompt.knowledge" }              // selector has a value
{ "compare": "target.distance", "op": "<=", "value": 30 }   // = != < <= > >= ; value = number, ordinal name, selector, or expression
{ "in": "target.tags", "set": ["aberration", "fey"] }
{ "in": "target.tags", "param": "types" }            // membership in the character's chosen tags
{ "history": { "event": "miss", "by": "me", "vs": "current", "scope": "thisRound" }, "op": ">=", "value": 1 }
```

History filters: event ∈ hit, miss, crit, attack, used (with `abilityId`), activated, damaged, moved; by ∈ me, target, any; vs ∈ current, any, sameCategory (with `category`); scope ∈ thisRound, lastRound, encounter, day. `{ "all": [] }` means always.

## Effects

| Verb | Fields | Example |
|---|---|---|
| modify | to (stat or skill.<id>), value (number, expression, or prompt table), type (bonus type), mode add\|set\|multiply, attackKind? | `{ "verb": "modify", "to": "attack", "value": 4 }` |
| dice | dice, damageType?, label?, attackKind? | `{ "verb": "dice", "dice": "1d6", "damageType": "fire" }` |
| flag | flag, value | `{ "verb": "flag", "flag": "neverFlatFooted" }` |
| tag | to self\|target\|allEnemies, tag, duration | `{ "verb": "tag", "to": "target", "tag": "flanked", "duration": "untilMyNextTurn" }` |
| grant | ability, duration? | `{ "verb": "grant", "ability": "rage" }` (starts it as a buff) |
| suppress | ability | anti-magic, rulings |
| resource | id, op consume\|restore\|set, amount | `{ "verb": "resource", "id": "boots-rounds", "op": "consume", "amount": 1 }` |
| attack | mode {id,label,base}, extraAttacks, penaltyAll, appliesToBase, naturalAttack {name,dice,count}, attackKind | Rapid Shot: `{ "verb": "attack", "mode": { "id": "rapid-shot", "label": "Rapid Shot", "base": "full" }, "extraAttacks": 1, "penaltyAll": -2, "attackKind": "ranged" }` |
| slot | slot, count | Hand of Glory: `{ "verb": "slot", "slot": "ring" }` |
| hp | op damage\|heal\|temp, amount | potions |
| prompt | id, label?, per?, remember | asks for a value (a check result) |
| note | text with `{expr}`, dc? | `{ "verb": "note", "text": "Fort DC {damage + classLevel(monster-hunter) + wisMod} or die" }` |
| reveal | | target's lore becomes visible |

Prompt tables: `"value": { "prompt": "knowledge", "per": "creatureType", "table": [{ "upTo": 15, "value": 1 }, { "upTo": 25, "value": 2 }, { "value": 3 }] }`.

Expressions: numbers, `strMod`…`chaMod`, `level`, `bab`, `round`, `damage` (last dealt), `classLevel(ranger)`, `prompt(knowledge)`, `sel(self.equipped.count.tag.trophy-aberration)`, character vars, `+ - * /`, `floor min max`. Dotted selectors without hyphens can be written directly: `self.class.ranger.level`.

## Worked examples

**Woodland Archer, Adjust for Range** — `when: { all: [ { compare: "attack.kind", op: "=", value: "ranged" }, { history: { event: "miss", vs: "current", scope: "thisRound" } } ] }`, `do: [ { verb: "modify", to: "attack", value: 4 } ]`.

**Monster Blow** — declare; resource 1/day scaling with class level; block `when: { all: [ { is: "battle.toggle.monster-blow" }, { in: "target.tags", param: "types" }, { compare: "target.hurt", op: ">=", value: "bloodied" } ] }`, `do: [ { verb: "note", text: "Fort DC {damage + classLevel(monster-hunter) + wisMod} or die" } ]`; `onUse` block consumes the charge.

**Boots of Speed** — toggle, cost charge `boots-rounds`, always-block with the haste effects; a round is spent at each Next round while on; switches off when dry.

**Medusa mask** — item, head slot; `naturalAttack` snakes; 1/day gaze as a granted spell-like ability with its own resource.

**Monster Horror** — `modify attack` with value `max(2, 2 * sel(self.equipped.count.tag.trophy-aberration))` when the target is one of the chosen types.
