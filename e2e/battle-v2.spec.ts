import { test, expect } from '@playwright/test';

async function startWithGargoyle(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /New battle/ }).click();
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByPlaceholder('Gargoyle').fill('Gargoyle');
  await page.getByRole('button', { name: 'Monstrous Humanoid', exact: true }).click();
  await page.getByRole('button', { name: /^Add Gargoyle$/ }).click();
}

test('Hand of Glory: Daylight and See Invisibility are separate actions with their own charges', async ({ page }) => {
  await startWithGargoyle(page);
  const daylight = page.locator('[data-ability="hog-daylight"]');
  const seeInvis = page.locator('[data-ability="hog-see-invisibility"]');
  await expect(daylight).toContainText('Hand of Glory');
  await expect(daylight).toContainText('1/1');
  await daylight.getByRole('button', { name: 'Use' }).click();
  await expect(daylight).toContainText('0/1');
  await expect(seeInvis).toContainText('1/1');
});

test('distance chip enables Point Blank Shot; Boots of Speed toggle adds an attack and ticks per round', async ({ page }) => {
  await startWithGargoyle(page);
  const rows = page.locator('[data-attack]');
  await expect(rows.nth(0)).toContainText('+12');
  await page.getByRole('button', { name: '30 ft', exact: true }).click();
  await expect(rows.nth(0)).toContainText('+13'); // Point Blank Shot
  await expect(rows).toHaveCount(2);
  const boots = page.locator('[data-ability="boots-of-speed"]');
  await expect(boots).toContainText('8/10');
  await boots.getByRole('button', { name: 'Start' }).click();
  await expect(rows).toHaveCount(3); // haste extra attack
  await expect(rows.nth(0)).toContainText('+14'); // +1 dodge
  await expect(boots).toContainText('8/10'); // nothing spent until the round executes
  await page.getByRole('button', { name: /Next round/ }).click();
  await expect(boots).toContainText('7/10');
  await expect(boots).toContainText('ACTIVE this round'); // stays on
  await boots.getByRole('button', { name: 'Stop' }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: /Next round/ }).click();
  await expect(boots).toContainText('7/10'); // off during that round: no charge
});

test('it hit me: logs enemy action and reduces HP', async ({ page }) => {
  await startWithGargoyle(page);
  await page.getByPlaceholder('dmg').fill('7');
  await page.getByRole('button', { name: 'it hit me' }).click();
  await page.getByRole('button', { name: /Log \(/ }).click();
  await expect(page.getByText('R1Gargoyle hit you for 7')).toBeVisible();
  await page.getByRole('button', { name: /Memento/ }).click();
  await expect(page.getByRole('button', { name: '/ 50' })).toBeVisible();
  await expect(page.getByText('43', { exact: true })).toBeVisible();
});
