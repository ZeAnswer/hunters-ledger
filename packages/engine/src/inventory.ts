import { newId } from './ids';
import type { Character } from './schema';

export type InventoryItem = Character['inventory'][number];

/** Equip/unequip; an item's linked ability follows (added to the sheet if missing). */
export function setEquipped(character: Character, itemId: string, equipped: boolean): Character {
  const item = character.inventory.find((i) => i.id === itemId);
  if (!item) return character;
  const inventory = character.inventory.map((i) => (i.id === itemId ? { ...i, equipped } : i));
  let abilities = character.abilities;
  if (item.abilityId) {
    const has = abilities.some((a) => a.abilityId === item.abilityId);
    abilities = has
      ? abilities.map((a) => (a.abilityId === item.abilityId ? { ...a, enabled: equipped } : a))
      : [...abilities, { abilityId: item.abilityId, enabled: equipped, paramValues: {} }];
  }
  return { ...character, inventory, abilities };
}

export function addInventoryItem(character: Character, item: Partial<InventoryItem> & { name: string }): Character {
  const full: InventoryItem = { id: newId('item'), quantity: 1, equipped: false, category: 'gear', ...item };
  return { ...character, inventory: [...character.inventory, full] };
}

export function removeInventoryItem(character: Character, itemId: string): Character {
  const item = character.inventory.find((i) => i.id === itemId);
  const c = item?.abilityId && item.equipped ? setEquipped(character, itemId, false) : character;
  return { ...c, inventory: c.inventory.filter((i) => i.id !== itemId) };
}
