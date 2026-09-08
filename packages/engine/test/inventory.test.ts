import { setEquipped, addInventoryItem } from '../src/inventory';
import { makeCharacter } from './fixtures';

const c = makeCharacter({
  abilities: [{ abilityId: 'ring-of-protection-1', enabled: false, paramValues: {} }],
  inventory: [
    { id: 'i1', name: 'Ring of Protection +1', abilityId: 'ring-of-protection-1', quantity: 1, equipped: false },
    { id: 'i2', name: "Gargoyle's hands", quantity: 1, equipped: false },
  ],
});

test('equipping an item with an ability enables that ability; unequipping disables it', () => {
  const on = setEquipped(c, 'i1', true);
  expect(on.inventory[0]!.equipped).toBe(true);
  expect(on.abilities.find((a) => a.abilityId === 'ring-of-protection-1')!.enabled).toBe(true);
  const off = setEquipped(on, 'i1', false);
  expect(off.abilities.find((a) => a.abilityId === 'ring-of-protection-1')!.enabled).toBe(false);
});

test('equipping an item whose ability is not on the sheet adds it', () => {
  const c2 = { ...c, abilities: [] };
  const on = setEquipped(c2, 'i1', true);
  expect(on.abilities).toEqual([{ abilityId: 'ring-of-protection-1', enabled: true, paramValues: {} }]);
});

test('plain items just toggle', () => {
  expect(setEquipped(c, 'i2', true).inventory[1]!.equipped).toBe(true);
});

test('addInventoryItem generates an id and defaults', () => {
  const n = addInventoryItem(c, { name: 'Potion', quantity: 2 });
  expect(n.inventory.at(-1)).toMatchObject({ name: 'Potion', quantity: 2, equipped: false });
  expect(n.inventory.at(-1)!.id).toMatch(/^item-/);
});
