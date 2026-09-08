import { test, expect } from '@playwright/test';

test('inventory: slots, extra ring slot from Hand of Glory, replace in a full slot, storage checkmarks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Inventory/ }).click();
  // Ring 1/2 filled, Ring 3 exists thanks to Hand of Glory's extra slot
  await expect(page.getByText('Ring 1')).toBeVisible();
  await expect(page.getByText('Ring 3')).toBeVisible();
  const arms = page.locator('div', { hasText: /^Arms/ }).filter({ has: page.getByRole('button', { name: /Bracers of Archery/ }) }).first();
  await expect(arms).toBeVisible();
  // all items tab with checkmarks
  await page.getByRole('button', { name: /All items/ }).click();
  await expect(page.getByRole('button', { name: /✓.*Belt of Strength/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /○.*Bracers of Armor/ })).toBeVisible();
  // equip bracers of armor → arms slot full → replace
  await page.getByRole('button', { name: /○.*Bracers of Armor/ }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Equip', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByRole('button', { name: /✓.*Bracers of Armor/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /○.*Bracers of Archery/ })).toBeVisible();
  // AC now includes armor bonus +1 → 15
  await page.getByRole('button', { name: /Memento/ }).click();
  await page.getByRole('button', { name: /^▸ Stats/ }).click();
  await expect(page.getByText('AC15')).toBeVisible();
});

test('inventory: create a new item from the inventory and add from library', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Inventory/ }).click();
  await page.getByRole('button', { name: '+ New item' }).click();
  const sheet = page.locator('.fixed.inset-0');
  await sheet.getByLabel('Name').fill('Lucky Charm');
  await sheet.getByLabel('Item category').selectOption('wondrous');
  await sheet.getByRole('button', { name: 'Neck', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: /All items/ }).click();
  await expect(page.getByRole('button', { name: /○.*Lucky Charm/ })).toBeVisible();
  await page.getByRole('button', { name: 'From library' }).click();
  await page.getByPlaceholder('Search…').fill('gorgon');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: /Gorgon's scale/ })).toHaveCount(2);
});
