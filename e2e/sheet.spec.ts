import { test, expect } from '@playwright/test';
test('sheets close via button and browser back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Memento/ }).click();
  await page.getByRole('button', { name: /^▸ Feats/ }).click();
  await page.getByRole('button', { name: /Woodland Archer/ }).click();
  await expect(page.getByRole('button', { name: 'Remove from character' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByRole('button', { name: 'Remove from character' })).toHaveCount(0);
  // back button also closes
  await page.getByRole('button', { name: /Woodland Archer/ }).click();
  await expect(page.getByRole('button', { name: 'Remove from character' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Remove from character' })).toHaveCount(0);
  await page.getByRole('button', { name: /Inventory/ }).click();
  await page.getByRole('button', { name: /All items/ }).click();
});
