import { create } from 'zustand';
import {
  BattleSchema, CharacterSchema, PackSchema, emptyLibrary, mergePack, libraryToPack, newBattle,
  type Battle, type Character, type EvalContext, type LibraryWithMeta, type MergeReport, type Monster, type Pack,
} from '@hl/engine';
import { storage } from '../storage';
import { defaultPacks } from '../data/defaultPacks';

export type FullLibrary = LibraryWithMeta & { monsters: Record<string, Monster>; characters: Record<string, Character> };

export type Screen = 'battle' | 'character' | 'library' | 'settings';

type State = {
  hydrated: boolean;
  library: FullLibrary;
  character: Character | undefined;
  battle: Battle | undefined;
  pastBattles: Battle[];
  screen: Screen;
  targetId: string | undefined;
  toast: string | undefined;
};

type Actions = {
  hydrate(): Promise<void>;
  setScreen(s: Screen): void;
  setTarget(id: string | undefined): void;
  setCharacter(c: Character): void;
  setBattle(b: Battle | undefined): void;
  startBattle(name?: string): void;
  endBattle(): void;
  setLibrary(l: FullLibrary): void;
  importPack(pack: Pack, opts?: { overwrite?: boolean }): MergeReport;
  importText(text: string, opts?: { overwrite?: boolean }): { report?: MergeReport; error?: string };
  exportLibraryText(): string;
  exportBackupText(): string;
  restoreBackupText(text: string): string | undefined;
  resetToDefaults(): Promise<void>;
  showToast(msg: string): void;
};

export type Store = State & Actions;

const KEYS = { library: 'hl.library', character: 'hl.character', battle: 'hl.battle', past: 'hl.pastBattles', screen: 'hl.screen' } as const;

function fullEmpty(): FullLibrary {
  return { ...emptyLibrary(), monsters: {}, characters: {} };
}

export const useStore = create<Store>((set, get) => ({
  hydrated: false,
  library: fullEmpty(),
  character: undefined,
  battle: undefined,
  pastBattles: [],
  screen: 'battle',
  targetId: undefined,
  toast: undefined,

  async hydrate() {
    const s = storage();
    const [library, character, battle, past, screen] = await Promise.all([
      s.get<FullLibrary>(KEYS.library), s.get<Character>(KEYS.character), s.get<Battle>(KEYS.battle), s.get<Battle[]>(KEYS.past), s.get<Screen>(KEYS.screen),
    ]);
    if (!library) {
      let lib = fullEmpty();
      for (const p of defaultPacks) lib = mergePack(lib, p).library as FullLibrary;
      const ch = Object.values(lib.characters)[0];
      set({ library: lib, character: ch, hydrated: true, screen: 'battle' });
      return;
    }
    set({
      library: { ...fullEmpty(), ...library },
      character: character ? CharacterSchema.parse(character) : Object.values(library.characters ?? {})[0],
      battle: battle ? BattleSchema.parse(battle) : undefined,
      pastBattles: past ?? [],
      screen: screen ?? 'battle',
      hydrated: true,
    });
  },

  setScreen: (screen) => set({ screen }),
  setTarget: (targetId) => set({ targetId }),
  setCharacter: (character) => set({ character }),
  setBattle: (battle) => set({ battle }),
  startBattle: (name) => set({ battle: newBattle(name ?? `Battle ${new Date().toLocaleDateString()}`), targetId: undefined }),
  endBattle: () => {
    const { battle, pastBattles } = get();
    if (!battle) return;
    set({ battle: undefined, targetId: undefined, pastBattles: [{ ...battle, ended: true }, ...pastBattles].slice(0, 20) });
  },
  setLibrary: (library) => set({ library }),

  importPack(pack, opts) {
    const { library, character } = get();
    const m = mergePack(library, pack, opts);
    const lib = { ...fullEmpty(), ...m.library } as FullLibrary;
    // If the pack carries the active character (or we have none), refresh it.
    const incoming = pack.characters.find((c) => c.id === character?.id) ?? (character ? undefined : pack.characters[0]);
    set({ library: lib, ...(incoming && (opts?.overwrite || !character || !m.report.conflicts.some((c) => c.key === `character:${incoming.id}`)) ? { character: incoming } : {}) });
    return m.report;
  },

  importText(text, opts) {
    try {
      const raw = JSON.parse(text);
      const r = PackSchema.safeParse(raw);
      if (!r.success) return { error: r.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') };
      return { report: get().importPack(r.data, opts) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },

  exportLibraryText() {
    const { library, character } = get();
    const lib = character ? { ...library, characters: { ...library.characters, [character.id]: character } } : library;
    return JSON.stringify(libraryToPack(lib, { id: 'library-export', name: 'Library export', version: Date.now() }), null, 2);
  },

  exportBackupText() {
    const { library, character, battle, pastBattles } = get();
    return JSON.stringify({ kind: 'hl-backup', version: 1, library, character, battle, pastBattles }, null, 2);
  },

  restoreBackupText(text) {
    try {
      const raw = JSON.parse(text);
      if (raw?.kind !== 'hl-backup') return 'Not a Hunter\'s Ledger backup file';
      set({
        library: { ...fullEmpty(), ...raw.library },
        character: raw.character ? CharacterSchema.parse(raw.character) : undefined,
        battle: raw.battle ? BattleSchema.parse(raw.battle) : undefined,
        pastBattles: raw.pastBattles ?? [],
      });
      return undefined;
    } catch (e) {
      return (e as Error).message;
    }
  },

  async resetToDefaults() {
    const s = storage();
    for (const k of Object.values(KEYS)) await s.remove(k);
    set({ hydrated: false, library: fullEmpty(), character: undefined, battle: undefined, pastBattles: [], targetId: undefined });
    await get().hydrate();
  },

  showToast(msg) {
    set({ toast: msg });
    setTimeout(() => set((s) => (s.toast === msg ? { toast: undefined } : {})), 2500);
  },
}));

// ---- persistence: save changed slices, debounced ----
let timer: ReturnType<typeof setTimeout> | undefined;
let last: Partial<State> = {};
useStore.subscribe((s) => {
  if (!s.hydrated) return;
  const changed: Partial<State> = {};
  if (s.library !== last.library) changed.library = s.library;
  if (s.character !== last.character) changed.character = s.character;
  if (s.battle !== last.battle) changed.battle = s.battle;
  if (s.pastBattles !== last.pastBattles) changed.pastBattles = s.pastBattles;
  if (s.screen !== last.screen) changed.screen = s.screen;
  last = { library: s.library, character: s.character, battle: s.battle, pastBattles: s.pastBattles, screen: s.screen };
  if (Object.keys(changed).length === 0) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const st = storage();
    if ('library' in changed) void st.set(KEYS.library, changed.library);
    if ('character' in changed) void (changed.character ? st.set(KEYS.character, changed.character) : st.remove(KEYS.character));
    if ('battle' in changed) void (changed.battle ? st.set(KEYS.battle, changed.battle) : st.remove(KEYS.battle));
    if ('pastBattles' in changed) void st.set(KEYS.past, changed.pastBattles);
    if ('screen' in changed) void st.set(KEYS.screen, changed.screen);
  }, 300);
});

/** Evaluation context for the engine from current store state. */
export function selectCtx(s: Store): EvalContext | undefined {
  if (!s.character) return undefined;
  const target = s.battle?.combatants.find((c) => c.id === s.targetId);
  return { character: s.character, library: s.library, ...(s.battle ? { battle: s.battle } : {}), ...(target ? { target } : {}) };
}
