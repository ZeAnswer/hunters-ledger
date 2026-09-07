import { test, expect } from '@playwright/test';

test('level up to Monster Hunter 2: HP, class level, feature, journal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Memento/ }).click();
  await expect(page.getByRole('button', { name: '/ 50' })).toBeVisible(); // 44 rolled + 6 Con
  await expect(page.getByText('Ranger 5 / Monster Hunter 1 · level 6')).toBeVisible();

  await page.getByRole('button', { name: '+ Level up' }).click();
  const sheet = page.locator('.fixed.inset-0');
  await sheet.getByRole('button', { name: /Monster Hunter \(d10\)/ }).click();
  await expect(sheet.getByText(/class features: Monster Lore/)).toBeVisible();
  await expect(sheet.getByText(/no general feat/)).toBeVisible();
  await sheet.getByLabel(/HP roll/).fill('7');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: '/ 58' })).toBeVisible();
  await expect(page.getByText('Ranger 5 / Monster Hunter 2 · level 7')).toBeVisible();
  await expect(page.getByText(/Lv 7 · Monster Hunter/)).toBeVisible();
  await expect(page.getByText(/levelUp.*Level 7: Monster Hunter · HP roll 7 \+1 Con/)).toBeVisible();
  await expect(page.getByText('BAB+7')).toBeVisible();
});
