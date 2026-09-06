import { emptyLibrary, mergePack, libraryToPack } from '../src/pack';
import { PackSchema } from '../src/schema';

const p1 = PackSchema.parse({
  id: 'core', name: 'Core', version: 1,
  tags: [{ id: 'aquatic', label: 'Aquatic', category: 'habitat' }],
  abilities: [{ id: 'rapid-shot', name: 'Rapid Shot', source: 'feat', effects: [] }],
  skills: [{ id: 'swim', name: 'Swim', ability: 'str' }],
  xpTable: [{ level: 1, xp: 0 }, { level: 2, xp: 1000 }],
});

test('merging into an empty library adds everything', () => {
  const { library, report } = mergePack(emptyLibrary(), p1);
  expect(Object.keys(library.abilities)).toEqual(['rapid-shot']);
  expect(library.tags.aquatic?.label).toBe('Aquatic');
  expect(library.xpTable).toHaveLength(2);
  expect(report).toMatchObject({ added: ['tag:aquatic', 'ability:rapid-shot', 'skill:swim'], updated: [], conflicts: [] });
});

test('same id from a newer pack version updates; same version with different content is a conflict', () => {
  const { library } = mergePack(emptyLibrary(), p1);
  const p2 = PackSchema.parse({ ...p1, version: 2, abilities: [{ id: 'rapid-shot', name: 'Rapid Shot (v2)', source: 'feat', effects: [] }] });
  const r2 = mergePack(library, p2);
  expect(r2.library.abilities['rapid-shot']!.name).toBe('Rapid Shot (v2)');
  expect(r2.report.updated).toEqual(['ability:rapid-shot']);

  const other = PackSchema.parse({ id: 'other', name: 'Other', version: 1, abilities: [{ id: 'rapid-shot', name: 'Different', source: 'feat', effects: [] }] });
  const r3 = mergePack(r2.library, other);
  expect(r3.report.conflicts).toEqual([expect.objectContaining({ key: 'ability:rapid-shot' })]);
  expect(r3.library.abilities['rapid-shot']!.name).toBe('Rapid Shot (v2)'); // kept existing
  expect(mergePack(r2.library, other, { overwrite: true }).library.abilities['rapid-shot']!.name).toBe('Different');
});

test('library round-trips through a pack', () => {
  const { library } = mergePack(emptyLibrary(), p1);
  const pack = libraryToPack(library, { id: 'backup', name: 'Backup', version: 3 });
  expect(PackSchema.safeParse(pack).success).toBe(true);
  const again = mergePack(emptyLibrary(), pack).library;
  expect({ ...again, meta: undefined }).toEqual({ ...library, meta: undefined });
});
