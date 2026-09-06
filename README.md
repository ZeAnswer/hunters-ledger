# Hunter's Ledger

D&D 3.5e battle assistant. Computes per-attack bonuses from modular JSON "packs" (feats, items, buffs, tags, monsters) with nested conditions and battle memory. Runs as a web app and as an Android app (Capacitor).

- `packages/engine` — pure TypeScript rules engine (zod schemas, evaluator). `npm test`
- `packages/app` — React + Vite + Tailwind UI. `npm run dev`
- `packs/` — authored content (JSON). Source of truth for feats/items/monsters.
- `tools/` — scripts: pack validation, bestiary extraction, RPG Scribe import.
- `docs/superpowers/specs/` — design spec.
