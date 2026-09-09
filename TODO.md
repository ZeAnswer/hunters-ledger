# TODO

## Battle
- [ ] **Activations per effect, not per item.** Using Hand of Glory spends Daylight and See Invisibility together. Each resource must be its own action: one "Use" per charge pool.
- [ ] **Activatable list with origin.** One list of everything that can be activated, each row with a subtext for its source: "Daylight — Hand of Glory", "Cure Light Wounds — ranger spell (Ranger 5)", "Monster Blow — Monster Hunter 1". Group by origin optional.
- [ ] Consumables: drinking a potion decrements quantity and logs it (heal amount prompt).
- [ ] Situational modifier: "save to library" to turn a one-off into a reusable ability.
- [ ] Attack profiles linked to weapon items (equipping a weapon supplies the profile).

## Rules builder
- [ ] **More basic logic blocks** for effects (to be designed with the user): smaller primitives, arithmetic/comparison on values, counters, "per N" scaling, cleaner composition. User will think about it.
- [ ] Preview an effect against a sample target inside the editor.

## Character data to confirm (Memento)
- [ ] Favored enemy types (export UUIDs 321140E5, E6E711CC) and which one is +4.
- [ ] Monster Killer picks (3 types).
- [ ] Five skills with unresolved UUIDs (D11C1603, 700AC2F3, D80DE6A9, ECB3CA28 with 8/8/8/7 ranks; 40AD06C4 class-skill override, 6 ranks).
- [ ] Feat slot placements guessed: Point Blank Shot (level 1 human bonus), Knowledge Devotion (level 3).
- [ ] HP rolls at levels 5 and 6 (export says "1"; modeled 6/6 to total 44).
- [ ] Knowledge (Monsters): 8 ranks exceeds the class cap of MH level + 5 = 6; DM ruling.
- [ ] Ranger spells known (export spell UUIDs unresolved); spells/day var `rangerSpells1`.

## Level ledger
- [ ] Spells learned per level; spell list per class.
- [ ] Guided level-up wizard with prerequisites (later).

## Platform
- [ ] Android APK via Capacitor (needs Android Studio + JDK on the mac; `docs/ANDROID.md`).
- [ ] Decide whether `tools/data/memento-rpgscribe.json` (DM's Hebrew memory notes) stays in the public repo.
- [ ] Lazy-load the bestiary pack (1.8 MB) instead of bundling it in the main chunk.
- [ ] Migration for pre-slot inventory entries (old phone data without abilityId).

## Later
- [ ] Multi-character / party sync.
- [ ] Initiative order.
- [ ] In-app dice.
